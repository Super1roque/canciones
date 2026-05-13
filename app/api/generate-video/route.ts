/**
 * POST /api/generate-video
 * Acepta multipart/form-data:
 *   - photos:     uno o más archivos de imagen (en orden deseado)
 *   - duration:   duración total en segundos (3–300)
 *   - transition: tipo de transición (ver TRANSITIONS abajo)
 *
 * Genera un video 9:16 (1080×1920) y devuelve el archivo MP4.
 */

import { NextResponse } from 'next/server';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 300;

const FFMPEG_BIN = ffmpegInstaller.path;
const W = 1080;
const H = 1920;
const FPS = 30;
const TD = 0.8; // duración de transición en segundos

export type TransitionType =
  | 'fade_black'
  | 'fade_white'
  | 'hard_cut'
  | 'slide_right'
  | 'slide_left'
  | 'slide_up'
  | 'slide_down'
  | 'random';

const RANDOM_POOL: TransitionType[] = [
  'fade_black', 'fade_white',
  'slide_left', 'slide_right', 'slide_up', 'slide_down',
];

function pickRandom<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

// ── Ejecutor de ffmpeg ────────────────────────────────────────────────────────

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('[generate-video] ffmpeg', args.join(' '));
    execFile(FFMPEG_BIN, args, { maxBuffer: 200 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) {
        console.error('[generate-video] stderr:\n', stderr);
        reject(new Error(stderr?.slice(-800) || err.message));
      } else {
        resolve();
      }
    });
  });
}

// ── Escala y crop común ───────────────────────────────────────────────────────

const SCALE = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${FPS}`;

// ── FADE / HARD-CUT (concat simple) ──────────────────────────────────────────
//
// No hay solapamiento entre clips. Duración total = n × pt
// El fade es hacia negro o blanco al final/inicio de cada clip.

function buildFadeSlideshow(
  photoPaths: string[],
  outputPath: string,
  totalDuration: number,
  transition: 'fade_black' | 'fade_white' | 'hard_cut',
): Promise<void> {
  const n = photoPaths.length;
  const pt = totalDuration / n;
  const color = transition === 'fade_white' ? 'white' : 'black';
  const fd = transition === 'hard_cut' ? 0 : Math.min(0.8, Math.max(0.2, pt * 0.12));

  const args: string[] = [];
  for (const p of photoPaths) {
    args.push('-loop', '1', '-t', pt.toFixed(4), '-i', p);
  }

  const perClip = photoPaths.map((_, i) => {
    const base = `[${i}:v]${SCALE}`;
    if (transition === 'hard_cut') {
      return `${base}[v${i}]`;
    }
    const fadeOutStart = (pt - fd).toFixed(4);
    return (
      `${base},` +
      `fade=t=in:st=0:d=${fd.toFixed(4)}:color=${color},` +
      `fade=t=out:st=${fadeOutStart}:d=${fd.toFixed(4)}:color=${color}` +
      `[v${i}]`
    );
  });

  const concatInputs = photoPaths.map((_, i) => `[v${i}]`).join('');
  const filterComplex = n === 1
    ? perClip[0].replace(`[v0]`, '[vout]')
    : [...perClip, `${concatInputs}concat=n=${n}:v=1:a=0[vout]`].join(';');

  args.push(
    '-filter_complex', filterComplex,
    '-map', '[vout]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-y', outputPath,
  );
  return runFfmpeg(args);
}

// ── SLIDE (overlay con expresión de tiempo) ───────────────────────────────────
//
// Fórmula de duración (como xfade): total = n×pt − (n−1)×TD  →  pt = (total + (n−1)×TD) / n
//
// Estructura del timeline de salida:
//   [body_0] [trans_01] [body_1] [trans_12] ... [body_{n-1}]
//
// body_0          = trim 0..A      (A = pt − TD)
// body_i (middle) = trim TD..A     (duración = A − TD = pt − 2×TD)
// body_{n-1}      = trim TD..pt    (duración = A)
// trans_i         = overlay de tail_i sobre head_{i+1}  (TD segundos cada uno)

function overlayExpr(direction: string): string {
  // t va de 0 a TD; la expresión posiciona el clip B que entra
  const ease = `(1-(t/${TD}))`;  // 1→0 lineal; al reemplazar por pow(...,2) da ease-out
  switch (direction) {
    case 'slide_left':  return `x='${W}*${ease}':y=0`;          // B entra desde la derecha
    case 'slide_right': return `x='${-W}*${ease}':y=0`;         // B entra desde la izquierda
    case 'slide_up':    return `x=0:y='${H}*${ease}'`;           // B entra desde abajo
    case 'slide_down':  return `x=0:y='${-H}*${ease}'`;          // B entra desde arriba
    default:            return `x='${W}*${ease}':y=0`;
  }
}

function buildSlideSlideshow(
  photoPaths: string[],
  outputPath: string,
  totalDuration: number,
  direction: string,
): Promise<void> {
  const n = photoPaths.length;

  if (n === 1) {
    // Caso trivial: una sola foto, sin transición
    const args: string[] = [
      '-loop', '1', '-t', totalDuration.toFixed(4), '-i', photoPaths[0],
      '-vf', SCALE,
      '-map', '0:v',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      '-y', outputPath,
    ];
    return runFfmpeg(args);
  }

  // Duración de cada foto como clip (incluyendo su porción de transición)
  const pt = (totalDuration + (n - 1) * TD) / n;
  const A  = pt - TD;  // duración de cuerpo para foto 0 y n-1

  const args: string[] = [];
  for (const p of photoPaths) {
    args.push('-loop', '1', '-t', pt.toFixed(4), '-i', p);
  }

  const parts: string[] = [];

  // Cuántas salidas necesita cada split
  // foto 0:      split=2  → body, tail
  // foto middle: split=3  → head, body, tail
  // foto n-1:    split=2  → head, body
  for (let i = 0; i < n; i++) {
    const splits = (i === 0 || i === n - 1) ? 2 : 3;
    parts.push(`[${i}:v]${SCALE},split=${splits}` +
      Array.from({ length: splits }, (_, k) => `[v${i}_${k}]`).join(''));
  }

  // Trim: cuerpos y porciones de transición
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      // body:  0 .. A
      parts.push(`[v${i}_0]trim=0:${A.toFixed(4)},setpts=PTS-STARTPTS[c${i}]`);
      // tail:  A .. pt
      parts.push(`[v${i}_1]trim=${A.toFixed(4)}:${pt.toFixed(4)},setpts=PTS-STARTPTS[tail${i}]`);
    } else if (i === n - 1) {
      // head:  0 .. TD
      parts.push(`[v${i}_0]trim=0:${TD.toFixed(4)},setpts=PTS-STARTPTS[head${i}]`);
      // body:  TD .. pt
      parts.push(`[v${i}_1]trim=${TD.toFixed(4)}:${pt.toFixed(4)},setpts=PTS-STARTPTS[c${i}]`);
    } else {
      // head:  0 .. TD
      parts.push(`[v${i}_0]trim=0:${TD.toFixed(4)},setpts=PTS-STARTPTS[head${i}]`);
      // body:  TD .. A  (duración pt − 2×TD)
      parts.push(`[v${i}_1]trim=${TD.toFixed(4)}:${A.toFixed(4)},setpts=PTS-STARTPTS[c${i}]`);
      // tail:  A .. pt
      parts.push(`[v${i}_2]trim=${A.toFixed(4)}:${pt.toFixed(4)},setpts=PTS-STARTPTS[tail${i}]`);
    }
  }

  // Overlay transitions: tail_i + head_{i+1} → t_{i}{i+1}
  const expr = overlayExpr(direction);
  for (let i = 0; i < n - 1; i++) {
    parts.push(`[tail${i}][head${i + 1}]overlay=${expr}:eval=frame[t${i}${i + 1}]`);
  }

  // Concat final: c0, t01, c1, t12, c2 …
  const concatOrder: string[] = [];
  for (let i = 0; i < n; i++) {
    concatOrder.push(`[c${i}]`);
    if (i < n - 1) concatOrder.push(`[t${i}${i + 1}]`);
  }
  const totalSegs = concatOrder.length; // = 2n − 1
  parts.push(`${concatOrder.join('')}concat=n=${totalSegs}:v=1:a=0[vout]`);

  const filterComplex = parts.join(';');

  args.push(
    '-filter_complex', filterComplex,
    '-map', '[vout]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-y', outputPath,
  );
  return runFfmpeg(args);
}

// ── RANDOM: genera cada segmento por separado y concatena ────────────────────
//
// Para cada foto genera un clip body_i.mp4 y para cada par genera trans_i.mp4
// con la transición elegida aleatoriamente. Luego los une con concat demuxer.

function isSlide(t: TransitionType) {
  return t === 'slide_left' || t === 'slide_right' || t === 'slide_up' || t === 'slide_down';
}

async function buildRandomSlideshow(
  photoPaths: string[],
  outputPath: string,
  totalDuration: number,
  tmpDir: string,
): Promise<void> {
  const n = photoPaths.length;

  // Asignar una transición aleatoria a cada par (sin repetir consecutivas)
  const pairTransitions: TransitionType[] = [];
  let lastPicked = '';
  for (let i = 0; i < n - 1; i++) {
    // Barajar el pool evitando repetir la misma que la anterior
    const pool = RANDOM_POOL.filter(t => t !== lastPicked);
    const picked = pickRandom(pool, Math.floor(Math.random() * pool.length));
    pairTransitions.push(picked);
    lastPicked = picked;
  }

  console.log('[generate-video] random transitions:', pairTransitions);

  // Duración por foto (usando la fórmula de solapamiento con TD)
  const pt = n === 1 ? totalDuration : (totalDuration + (n - 1) * TD) / n;
  const A  = pt - TD;

  // 1. Generar clip escalado de cada foto (dura pt segundos)
  const scaledPaths: string[] = [];
  for (let i = 0; i < n; i++) {
    const out = path.join(tmpDir, `scaled_${i}.mp4`);
    await runFfmpeg([
      '-loop', '1', '-t', pt.toFixed(4), '-i', photoPaths[i],
      '-vf', SCALE,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '22',
      '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-y', out,
    ]);
    scaledPaths.push(out);
  }

  if (n === 1) {
    fs.copyFileSync(scaledPaths[0], outputPath);
    return;
  }

  // 2. Para cada foto, generar body clip (sin las porciones de transición)
  const bodyPaths: string[] = [];
  for (let i = 0; i < n; i++) {
    const out = path.join(tmpDir, `body_${i}.mp4`);
    let ss: number, dur: number;
    if      (i === 0)     { ss = 0;  dur = A; }       // sin head
    else if (i === n - 1) { ss = TD; dur = A; }        // sin tail
    else                  { ss = TD; dur = A - TD; }   // sin head ni tail
    await runFfmpeg([
      '-ss', ss.toFixed(4), '-t', dur.toFixed(4), '-i', scaledPaths[i],
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '22',
      '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-y', out,
    ]);
    bodyPaths.push(out);
  }

  // 3. Para cada par, generar clip de transición (TD segundos)
  const transPaths: string[] = [];
  for (let i = 0; i < n - 1; i++) {
    const t = pairTransitions[i];
    const out = path.join(tmpDir, `trans_${i}.mp4`);

    // tail del clip i: los últimos TD segundos
    const tailPath = path.join(tmpDir, `tail_${i}.mp4`);
    await runFfmpeg([
      '-ss', A.toFixed(4), '-t', TD.toFixed(4), '-i', scaledPaths[i],
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '22',
      '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-y', tailPath,
    ]);

    // head del clip i+1: los primeros TD segundos
    const headPath = path.join(tmpDir, `head_${i + 1}.mp4`);
    await runFfmpeg([
      '-ss', '0', '-t', TD.toFixed(4), '-i', scaledPaths[i + 1],
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '22',
      '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-y', headPath,
    ]);

    if (isSlide(t)) {
      // Slide: B entra sobre A usando overlay animado
      const expr = overlayExpr(t);
      await runFfmpeg([
        '-i', tailPath, '-i', headPath,
        '-filter_complex', `[0:v][1:v]overlay=${expr}:eval=frame[vout]`,
        '-map', '[vout]',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '22',
        '-pix_fmt', 'yuv420p', '-r', String(FPS),
        '-y', out,
      ]);
    } else if (t === 'hard_cut') {
      // Hard cut: mitad tail + mitad head (total = TD segundos)
      const half = (TD / 2).toFixed(4);
      await runFfmpeg([
        '-i', tailPath, '-i', headPath,
        '-filter_complex',
          `[0:v]trim=0:${half},setpts=PTS-STARTPTS[a];` +
          `[1:v]trim=0:${half},setpts=PTS-STARTPTS[b];` +
          `[a][b]concat=n=2:v=1:a=0[vout]`,
        '-map', '[vout]',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '22',
        '-pix_fmt', 'yuv420p', '-r', String(FPS),
        '-y', out,
      ]);
    } else {
      // Fade: tail se desvanece, head aparece
      const color = t === 'fade_white' ? 'white' : 'black';
      await runFfmpeg([
        '-i', tailPath, '-i', headPath,
        '-filter_complex',
          `[0:v]fade=t=out:st=0:d=${TD.toFixed(4)}:color=${color}[a];` +
          `[1:v]fade=t=in:st=0:d=${TD.toFixed(4)}:color=${color}[b];` +
          `[a][b]concat=n=2:v=1:a=0[vout]`,
        '-map', '[vout]',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '22',
        '-pix_fmt', 'yuv420p', '-r', String(FPS),
        '-y', out,
      ]);
    }

    transPaths.push(out);
  }

  // 4. Crear lista de concat y unir todos los segmentos
  const segments: string[] = [];
  for (let i = 0; i < n; i++) {
    segments.push(bodyPaths[i]);
    if (i < n - 1) segments.push(transPaths[i]);
  }

  const listPath = path.join(tmpDir, 'concat.txt');
  fs.writeFileSync(listPath, segments.map(s => `file '${s}'`).join('\n'));

  await runFfmpeg([
    '-f', 'concat', '-safe', '0', '-i', listPath,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-y', outputPath,
  ]);
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let tmpDir: string | null = null;

  try {
    const form        = await request.formData();
    const photos      = form.getAll('photos') as File[];
    const durationStr = form.get('duration') as string | null;
    const transition  = (form.get('transition') as TransitionType | null) ?? 'fade_black';

    if (!photos.length) {
      return NextResponse.json({ error: 'Se requiere al menos una foto.' }, { status: 400 });
    }
    if (!durationStr) {
      return NextResponse.json({ error: 'Se requiere la duración.' }, { status: 400 });
    }

    const duration = parseFloat(durationStr);
    if (isNaN(duration) || duration < 3 || duration > 300) {
      return NextResponse.json(
        { error: 'Duración inválida. Debe estar entre 3 y 300 segundos.' },
        { status: 400 }
      );
    }

    tmpDir = path.join(os.tmpdir(), `vid_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tmpDir);

    const photoPaths: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const ext   = path.extname(photo.name).toLowerCase() || '.jpg';
      const tmp   = path.join(tmpDir, `photo_${String(i).padStart(3, '0')}${ext}`);
      fs.writeFileSync(tmp, Buffer.from(await photo.arrayBuffer()));
      photoPaths.push(tmp);
    }

    const outputPath = path.join(tmpDir, 'output.mp4');

    if (transition === 'random') {
      await buildRandomSlideshow(photoPaths, outputPath, duration, tmpDir);
    } else if (isSlide(transition)) {
      await buildSlideSlideshow(photoPaths, outputPath, duration, transition);
    } else {
      await buildFadeSlideshow(photoPaths, outputPath, duration,
        transition as 'fade_black' | 'fade_white' | 'hard_cut');
    }

    const videoBuffer = fs.readFileSync(outputPath);

    return new Response(videoBuffer, {
      headers: {
        'Content-Type':        'video/mp4',
        'Content-Disposition': 'attachment; filename="video_canciones.mp4"',
        'Content-Length':      String(videoBuffer.length),
      },
    });

  } catch (err) {
    console.error('[/api/generate-video]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando el video.' },
      { status: 500 }
    );
  } finally {
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
    }
  }
}
