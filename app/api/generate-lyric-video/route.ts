/**
 * POST /api/generate-lyric-video
 * Acepta multipart/form-data:
 *   - scenes:       JSON string de { lines, searchQuery, duration? }[] — cada
 *                    "escena" trae su propia búsqueda de Pexels. El cliente de
 *                    /video-letra manda una escena de UNA sola línea por
 *                    verso (búsqueda específica a lo que dice ese verso), pero
 *                    esta ruta admite escenas de varias líneas igual —en ese
 *                    caso pide tantos clips DISTINTOS como líneas tenga esa
 *                    escena con una sola búsqueda compartida.
 *   - orientation:  'vertical' | 'horizontal'
 *   - totalDuration: duración total en segundos (solo se usa si NO se manda audio)
 *   - audio:        archivo de audio opcional. Si se manda, su duración manda
 *                    sobre `totalDuration` y se mezcla como pista de sonido.
 *
 * Sin texto superpuesto: cada línea se recorta a su propio clip descargado de
 * Pexels — el video cambia de plano en cada verso. Luego se concatenan todas
 * las líneas de todas las escenas en un único MP4.
 */

import { NextResponse } from 'next/server';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buscarClipsPexels, descargarArchivo, type Orientacion } from '@/lib/pexelsService';

export const runtime = 'nodejs';
export const maxDuration = 300;

const FFMPEG_BIN = ffmpegInstaller.path;
const FPS = 30;
const MIN_LINEA = 1.0; // piso de segundos por línea/plano

interface SceneLine {
  text: string;
  // Tiempos reales (segundos, relativos al inicio de la ESCENA) cuando
  // vienen de la transcripción de Deepgram — si faltan, la duración de esa
  // línea se calcula proporcional al largo del texto (modo letra manual).
  start?: number;
  end?: number;
}

interface Scene {
  lines: SceneLine[];
  searchQuery: string;
  // Duración real de la escena (segundos) cuando viene de una sección
  // detectada por Deepgram/Claude — si falta, se reparte proporcionalmente
  // del totalDuration entre todas las escenas (modo letra manual).
  duration?: number;
}

// ── ffmpeg helpers (mismo patrón que generate-video) ──

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('[generate-lyric-video] ffmpeg', args.join(' '));
    execFile(FFMPEG_BIN, args, { maxBuffer: 200 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) {
        console.error('[generate-lyric-video] stderr:\n', stderr);
        reject(new Error(stderr?.slice(-800) || err.message));
      } else {
        resolve();
      }
    });
  });
}

function getMediaDuration(filePath: string): Promise<number> {
  return new Promise(resolve => {
    execFile(FFMPEG_BIN, ['-i', filePath, '-hide_banner'],
      { maxBuffer: 512 * 1024 },
      (_err, _out, stderr) => {
        const m = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
        resolve(m ? +m[1] * 3600 + +m[2] * 60 + parseFloat(m[3]) : 0);
      });
  });
}

function muxAudio(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
  return runFfmpeg([
    '-i', videoPath, '-i', audioPath,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart',
    '-y', outputPath,
  ]);
}

// Reparte una duración total entre N "cosas" (escenas, o líneas dentro de
// una escena) proporcionalmente al largo de texto de cada una — con un
// piso mínimo para que ningún plano dure demasiado poco. Genérico porque se
// usa dos veces: para repartir el total entre estrofas/secciones, y de
// nuevo para repartir la duración de UNA escena entre sus líneas.
function repartirDuraciones(textos: string[], totalDuration: number, piso: number): number[] {
  const n = textos.length;
  const pesos = textos.map(t => Math.max(t.trim().length, 10));
  const pesoTotal = pesos.reduce((a, b) => a + b, 0);
  const base = Math.min(piso, totalDuration / n);
  const restante = Math.max(totalDuration - base * n, 0);
  return pesos.map(p => base + (pesoTotal > 0 ? (p / pesoTotal) * restante : 0));
}

export async function POST(request: Request) {
  let tmpDir: string | null = null;

  try {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'PEXELS_API_KEY no configurada en el servidor' }, { status: 500 });
    }

    const form = await request.formData();
    const scenesRaw = form.get('scenes') as string | null;
    const orientationInput = (form.get('orientation') as string | null) ?? 'vertical';
    const totalDurationStr = form.get('totalDuration') as string | null;
    const audioFile = form.get('audio') as File | null;

    if (!scenesRaw) {
      return NextResponse.json({ error: 'Se requieren las escenas' }, { status: 400 });
    }
    const scenes = JSON.parse(scenesRaw) as Scene[];
    if (!Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: 'La letra no generó ninguna escena' }, { status: 400 });
    }
    if (!totalDurationStr && !audioFile) {
      return NextResponse.json({ error: 'Se requiere la duración total o un audio' }, { status: 400 });
    }

    const vertical = orientationInput !== 'horizontal';
    const W = vertical ? 1080 : 1920;
    const H = vertical ? 1920 : 1080;
    const pexelsOrientation: Orientacion = vertical ? 'portrait' : 'landscape';
    const SCALE = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${FPS}`;

    tmpDir = path.join(os.tmpdir(), `lyricvid_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tmpDir);

    let audioPath: string | null = null;
    if (audioFile) {
      const ext = path.extname(audioFile.name).toLowerCase() || '.mp3';
      audioPath = path.join(tmpDir, `audio${ext}`);
      fs.writeFileSync(audioPath, Buffer.from(await audioFile.arrayBuffer()));
    }

    const totalDuration = audioFile
      ? await getMediaDuration(audioPath!)
      : parseFloat(totalDurationStr!);

    if (!totalDuration || isNaN(totalDuration) || totalDuration < 3 || totalDuration > 600) {
      return NextResponse.json({ error: 'Duración total inválida (debe estar entre 3 y 600 segundos)' }, { status: 400 });
    }

    // Duración de cada ESCENA: si todas traen `duration` real (modo
    // Deepgram, viene de una sección detectada del audio), se usa tal
    // cual; si no, se reparte proporcionalmente del totalDuration entre
    // todas (modo letra manual, sin audio transcripto).
    const todasConDuracionReal = scenes.every(s => typeof s.duration === 'number' && s.duration > 0);
    const duracionesEscena = todasConDuracionReal
      ? scenes.map(s => s.duration as number)
      : repartirDuraciones(scenes.map(s => s.lines.map(l => l.text).join(' ')), totalDuration, MIN_LINEA);

    // Duración de cada LÍNEA dentro de su escena: tiempos reales si vienen
    // de Deepgram, si no proporcional al largo del texto.
    const duracionesLineaPorEscena: number[][] = scenes.map((scene, i) => {
      const dur = duracionesEscena[i];
      const todasConTiempoReal = scene.lines.every(l => typeof l.start === 'number' && typeof l.end === 'number');
      if (todasConTiempoReal) {
        const base = scene.lines[0].start as number;
        const last = scene.lines[scene.lines.length - 1].end as number;
        const factor = last > base ? dur / (last - base) : 1;
        return scene.lines.map(l => Math.max(0.3, ((l.end as number) - (l.start as number)) * factor));
      }
      return repartirDuraciones(scene.lines.map(l => l.text), dur, MIN_LINEA);
    });

    // 1. Por cada escena, UNA sola búsqueda en Pexels (misma consulta) mide
    //    tantos clips DISTINTOS como líneas tenga esa escena — no gasta más
    //    cupo de la API pero le da un plano nuevo a cada línea.
    const clipsPorEscena = await Promise.all(scenes.map(async (scene, i) => {
      const archivos = await buscarClipsPexels(scene.searchQuery, pexelsOrientation, apiKey, scene.lines.length, i);
      if (!archivos.length) throw new Error(`No se encontró ningún clip para la escena ${i + 1} ("${scene.searchQuery}")`);
      return Promise.all(archivos.map(async (archivo, li) => {
        const dest = path.join(tmpDir!, `raw_${String(i).padStart(3, '0')}_${String(li).padStart(2, '0')}.mp4`);
        await descargarArchivo(archivo.link, dest);
        return dest;
      }));
    }));

    // 2. Procesar cada línea: escalar/recortar y ajustar a su propia
    //    duración (con loop si el clip es más corto de lo necesario) — sin
    //    texto superpuesto.
    const processedPaths: string[] = [];
    let contadorGlobal = 0;
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const clips = clipsPorEscena[i];
      const duraciones = duracionesLineaPorEscena[i];

      for (let li = 0; li < scene.lines.length; li++) {
        const dur = duraciones[li];
        const clipPath = clips[li];
        const clipDur = await getMediaDuration(clipPath);
        const needsLoop = clipDur > 0 && clipDur < dur;

        const out = path.join(tmpDir, `clip_${String(contadorGlobal).padStart(4, '0')}.mp4`);
        const args: string[] = [];
        if (needsLoop) args.push('-stream_loop', '-1');
        args.push('-i', clipPath, '-t', dur.toFixed(4));
        args.push('-vf', SCALE);
        args.push(
          '-an',
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
          '-pix_fmt', 'yuv420p', '-r', String(FPS),
          '-y', out,
        );
        await runFfmpeg(args);
        processedPaths.push(out);
        contadorGlobal++;
      }
    }

    // 3. Concatenar todas las líneas.
    const videoOnlyPath = path.join(tmpDir, 'video_only.mp4');
    const listPath = path.join(tmpDir, 'concat.txt');
    fs.writeFileSync(listPath, processedPaths.map(p => `file '${p}'`).join('\n'));
    await runFfmpeg([
      '-f', 'concat', '-safe', '0', '-i', listPath,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      '-y', videoOnlyPath,
    ]);

    // 4. Mezclar con el audio si se subió uno.
    let outputPath = videoOnlyPath;
    if (audioPath) {
      outputPath = path.join(tmpDir, 'output.mp4');
      await muxAudio(videoOnlyPath, audioPath, outputPath);
    }

    const videoBuffer = fs.readFileSync(outputPath);

    return new Response(videoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="video_relato.mp4"',
        'Content-Length': String(videoBuffer.length),
      },
    });

  } catch (err) {
    console.error('[/api/generate-lyric-video]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando el video.' },
      { status: 500 },
    );
  } finally {
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
    }
  }
}
