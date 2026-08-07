import { NextResponse } from 'next/server';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 300;

const FFMPEG_BIN = ffmpegInstaller.path;
const W = 720;
const H = 1280;

const MARK_START    = 15;
const MARK_INTERVAL = 22;
const MARK_DURATION = 3.5;
const DIM_LEVEL     = 0.10;
const WM_SR         = 44100;

// Caché de la voz "esta es una muestra" en PCM float32 (se genera una vez por proceso)
let wmPcmCache: Float32Array | null = null;

const FONT_CANDIDATES = [
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/System/Library/Fonts/Helvetica.ttc',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
];

// Fuente con soporte de símbolos Unicode (para el icono de teléfono ☎)
const SYMBOL_FONT_CANDIDATES = [
  '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
];

function findFont(): string | null {
  for (const f of FONT_CANDIDATES) if (fs.existsSync(f)) return f;
  return null;
}

function findSymbolFont(): string | null {
  for (const f of SYMBOL_FONT_CANDIDATES) if (fs.existsSync(f)) return f;
  return null;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('\n[ffmpeg] CMD:', args.join(' '), '\n');
    execFile(FFMPEG_BIN, args, { maxBuffer: 300 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) {
        console.error('[ffmpeg] STDERR:', stderr?.slice(-1500));
        reject(new Error(stderr?.slice(-1000) || err.message));
      } else {
        resolve();
      }
    });
  });
}

function getAudioDuration(filePath: string): Promise<number> {
  return new Promise(resolve => {
    // FFmpeg siempre imprime "Duration: HH:MM:SS.ss" en stderr aunque retorne error
    execFile(FFMPEG_BIN, ['-i', filePath, '-hide_banner'],
      { maxBuffer: 512 * 1024 },
      (_err, _out, stderr) => {
        const m = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
        resolve(m ? +m[1] * 3600 + +m[2] * 60 + parseFloat(m[3]) : 0);
      });
  });
}

type Cue = { start: number; end: number; text: string };

function assTime(sec: number): string {
  const h  = Math.floor(sec / 3600);
  const m  = Math.floor((sec % 3600) / 60);
  const s  = Math.floor(sec % 60);
  const cs = Math.round((sec % 1) * 100);
  return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
}

function generateASS(cues: Cue[]): string {
  // Colores ASS: &HAABBGGRR (00=opaco)
  // Amarillo: &H0000FFFF  Negro contorno: &H00000000
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,87,&H00FFFFFF,&H00FFFFFF,&H00FF00FF,&H90000000,-1,0,0,0,100,100,2,0,1,4,2,2,20,20,53,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  // \\an8 = top-center; posicionamos debajo del banner CTA (y≈280px)
  const events = cues.map(c =>
    `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Default,,0,0,0,,{\\an5\\pos(${W / 2},467)}${c.text}`
  ).join('\n');

  return `${header}\n${events}\n`;
}

function getWatermarkPcm(): Float32Array {
  if (wmPcmCache) return wmPcmCache;

  // Cargamos el PCM pre-generado (f32le, 44100Hz, mono) desde public/watermark.raw
  // Este archivo se genera una vez en el terminal con:
  //   say -v Paulina -r 150 "esta es una muestra" -o /tmp/wm.aiff
  //   ffmpeg -y -i /tmp/wm.aiff -f f32le -ar 44100 -ac 1 public/watermark.raw
  const rawPath = path.join(process.cwd(), 'public', 'watermark.raw');
  const buf     = fs.readFileSync(rawPath);
  wmPcmCache    = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  console.log('[wm] PCM cargado:', wmPcmCache.length, 'samples');
  return wmPcmCache;
}

// Mezcla la voz de marca de agua en el audio original (server-side, igual que el cliente)
async function applyWatermarkAudio(
  audioPath: string, tmpDir: string, errRef: { msg: string }
): Promise<string | null> {
  const pcmOrigPath = path.join(tmpDir, 'orig.raw');
  const pcmOutPath  = path.join(tmpDir, 'mixed.raw');
  const mixedPath   = path.join(tmpDir, 'mixed.wav');

  try {
    console.log('[wm] iniciando marca de agua...');
    const wm = getWatermarkPcm();

    // Decodificar audio original a PCM float32 mono
    await runFfmpeg(['-y', '-i', audioPath, '-f', 'f32le', '-ar', WM_SR.toString(), '-ac', '1', pcmOrigPath]);

    const origBuf = fs.readFileSync(pcmOrigPath);
    const orig    = new Float32Array(origBuf.buffer.slice(origBuf.byteOffset, origBuf.byteOffset + origBuf.length));
    const out     = new Float32Array(orig.length);
    console.log('[wm] orig samples:', orig.length, '| wm samples:', wm.length);

    // Mezclar — igual que processChannel() en muestra/page.tsx
    for (let i = 0; i < orig.length; i++) {
      const t        = i / WM_SR;
      const elapsed  = t - MARK_START;
      if (elapsed >= 0) {
        const posInCycle = elapsed % MARK_INTERVAL;
        if (posInCycle < MARK_DURATION) {
          const wmIdx = Math.round(posInCycle * WM_SR);
          out[i] = orig[i] * DIM_LEVEL + (wmIdx < wm.length ? wm[wmIdx] : 0);
          continue;
        }
      }
      out[i] = orig[i];
    }

    // Guardar PCM mezclado → WAV estéreo
    fs.writeFileSync(pcmOutPath, Buffer.from(out.buffer, out.byteOffset, out.byteLength));
    await runFfmpeg(['-y', '-f', 'f32le', '-ar', WM_SR.toString(), '-ac', '1', '-i', pcmOutPath,
                     '-ac', '2', mixedPath]);

    console.log('[wm] marca de agua aplicada OK');
    return mixedPath;
  } catch (e) {
    errRef.msg = (e as Error).message || String(e);
    console.error('[wm] ERROR:', errRef.msg);
    return null;
  }
}

export async function POST(request: Request) {
  console.log('[generate-sample-video] POST recibido');
  let tmpDir: string | null = null;

  try {
    const form  = await request.formData();
    const audio = form.get('audio') as File | null;
    const text  = ((form.get('text') as string | null) ?? '').trim();

    if (!audio) return NextResponse.json({ error: 'Se requiere el archivo de audio.' }, { status: 400 });

    tmpDir = path.join(os.tmpdir(), `sample_${Date.now()}`);
    fs.mkdirSync(tmpDir);

    const audioPath = path.join(tmpDir, `audio${path.extname(audio.name).toLowerCase() || '.mp3'}`);
    fs.writeFileSync(audioPath, Buffer.from(await audio.arrayBuffer()));

    // Subtítulos opcionales via Deepgram
    const cuesRaw = (form.get('cues') as string | null) ?? '';
    const cues: Cue[] = cuesRaw
      ? (JSON.parse(cuesRaw) as Cue[]).filter(c => c.start < 60)
      : [];
    let assPath: string | null = null;
    if (cues.length > 0) {
      assPath = path.join(tmpDir, 'subs.ass');
      fs.writeFileSync(assPath, generateASS(cues), 'utf8');
      console.log('[generate-sample-video] subtítulos ASS:', cues.length, 'cues (primer minuto)');
    }

    const outputPath  = path.join(tmpDir, 'output.mp4');
    const wmErrRef    = { msg: '' };
    const mixedAudio  = await applyWatermarkAudio(audioPath, tmpDir, wmErrRef);
    const finalAudio  = mixedAudio !== null ? mixedAudio : audioPath;
    console.log('[generate-sample-video] audio final:', mixedAudio ? 'CON marca de agua' : `SIN marca de agua: ${wmErrRef.msg}`);

    const font = findFont();
    console.log('[generate-sample-video] fuente:', font);
    const fp = font ? `fontfile='${font}':` : '';

    const symbolFont = findSymbolFont();
    const fps = symbolFont ? `fontfile='${symbolFont}':` : '';

    const eqH   = 100;
    const bandH = 120;
    const eqY   = H - bandH - eqH;

    // Rótulo CTA estático multi-línea en la parte superior
    const ctaText = 'LE HACEMOS UNA CANCION\nCOMPLETA CON SU HISTORIA\nCON ESTA PISTA O CON OTRA,\nPOR SOLAMENTE 500.00 LEMPIRAS';
    const ctaPath = path.join(tmpDir, 'cta.txt');
    fs.writeFileSync(ctaPath, ctaText, 'utf8');
    const ctaY = 36;
    const ctaH = 302;

    // Franja roja + mensaje (sin el badge de WhatsApp, se agrega después con overlay)
    const ctaBanner = [
      `drawbox=x=0:y=${ctaY}:w=iw:h=${ctaH}:color=0xAA0000@0.93:t=fill`,
      `drawbox=x=0:y=${ctaY}:w=iw:h=5:color=0xFFD700:t=fill`,
      `drawbox=x=0:y=${ctaY + ctaH - 5}:w=iw:h=5:color=0xFFD700:t=fill`,
      `drawtext=${fp}textfile='${ctaPath}':fontsize=36:fontcolor=0xFFE600:x=(w-text_w)/2:y=${ctaY + 14}:line_spacing=6:shadowcolor=0x000000@0.85:shadowx=2:shadowy=2`,
    ].join(',');

    // Badge circular estilo WhatsApp (círculo verde con ícono de teléfono) + número
    const waSize   = 60;
    const waX      = 240;
    const waY      = ctaY + 200;
    const waNumX   = 314;
    const waBadgeGen = [
      `color=c=0x25D366:s=${waSize}x${waSize}[wabg]`,
      `[wabg]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(pow(X-${waSize / 2}\\,2)+pow(Y-${waSize / 2}\\,2),${(waSize / 2) * (waSize / 2)}),255,0)'[wacircle]`,
    ].join(';');
    const waContact = [
      `drawtext=${fps}text='☎':fontsize=34:fontcolor=white:x=${waX}+(${waSize}-text_w)/2:y=${waY}+(${waSize}-text_h)/2`,
      `drawtext=${fp}text='9689-5978':fontsize=48:fontcolor=white:x=${waNumX}:y=${waY}+(${waSize}-text_h)/2:shadowcolor=0x000000@0.85:shadowx=2:shadowy=2`,
    ].join(',');

    // Fondo animado estilo mariachi/corrido
    const bgFilters = [
      // Franjas bandera mexicana — borde superior
      `drawbox=x=0:y=0:w=iw:h=12:color=0x006600:t=fill`,
      `drawbox=x=0:y=12:w=iw:h=12:color=0xEEEEEE@0.6:t=fill`,
      `drawbox=x=0:y=24:w=iw:h=12:color=0xCC0000:t=fill`,
      // Franjas bandera mexicana — borde inferior
      `drawbox=x=0:y=ih-36:w=iw:h=12:color=0x006600:t=fill`,
      `drawbox=x=0:y=ih-24:w=iw:h=12:color=0xEEEEEE@0.6:t=fill`,
      `drawbox=x=0:y=ih-12:w=iw:h=12:color=0xCC0000:t=fill`,
      // Rayos de escenario oscilantes
      `drawbox=x='sin(t/3)*200+133':y=0:w=67:h=ih:color=0xFF6B00@0.12:t=fill`,
      `drawbox=x='sin(t/4+1)*200+333':y=0:w=53:h=ih:color=0xCC0000@0.10:t=fill`,
      `drawbox=x='sin(t/5+2)*200+533':y=0:w=67:h=ih:color=0xFFD700@0.10:t=fill`,
      `drawbox=x='sin(t/3.5+3)*200+233':y=0:w=40:h=ih:color=0x006600@0.08:t=fill`,
      `drawbox=x='sin(t/2.5+4)*233+360':y=0:w=47:h=ih:color=0xFFFFFF@0.04:t=fill`,
      `drawbox=x='sin(t/6+5)*187+467':y=0:w=33:h=ih:color=0xFF6B00@0.07:t=fill`,
      // Líneas horizontales barriendo (luces de piso)
      `drawbox=x=0:y='mod(t*50\\,1280)':w=iw:h=2:color=0xFFD700@0.18:t=fill`,
      `drawbox=x=0:y='mod(t*50+426\\,1280)':w=iw:h=2:color=0xCC0000@0.14:t=fill`,
      `drawbox=x=0:y='mod(t*50+853\\,1280)':w=iw:h=2:color=0x006600@0.14:t=fill`,
      // Notas musicales flotando
      `drawtext=${fp}text='♪':fontsize=133:fontcolor=0xFFD700@0.25:x=67:y='mod(1280-t*80\\,1467)-200'`,
      `drawtext=${fp}text='♫':fontsize=107:fontcolor=0xCC0000@0.20:x=500:y='mod(1280-t*65+267\\,1467)-200'`,
      `drawtext=${fp}text='♪':fontsize=93:fontcolor=0x00AA00@0.18:x=267:y='mod(1280-t*75+533\\,1467)-200'`,
      `drawtext=${fp}text='♬':fontsize=120:fontcolor=0xFFD700@0.22:x=587:y='mod(1280-t*55+800\\,1467)-200'`,
      `drawtext=${fp}text='♩':fontsize=80:fontcolor=0xCC0000@0.18:x=400:y='mod(1280-t*90+200\\,1467)-200'`,
      `drawtext=${fp}text='♫':fontsize=100:fontcolor=0x00AA00@0.16:x=167:y='mod(1280-t*70+1067\\,1467)-200'`,
      // Asteriscos como estrellas de escenario flotando
      `drawtext=${fp}text='*':fontsize=87:fontcolor=0xFFD700@0.35:x=367:y='mod(1280-t*40+400\\,1400)-133'`,
      `drawtext=${fp}text='*':fontsize=60:fontcolor=0xFFFFFF@0.25:x=200:y='mod(1280-t*35+733\\,1400)-133'`,
      `drawtext=${fp}text='*':fontsize=73:fontcolor=0xCC0000@0.28:x=547:y='mod(1280-t*45+1133\\,1400)-133'`,
      `vignette=PI/3`,
    ].join(',');

    const marqueeY = 667;

    const waves = `[1:a]showwaves=s=${W}x${eqH}:mode=cline:colors=0xFF7316:draw=full:scale=sqrt[eqv]`;

    let filterComplex: string;

    const assFilter = assPath ? `,ass='${assPath}'` : '';

    if (text) {
      const cleanText = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
      const textPath  = path.join(tmpDir, 'overlay.txt');
      fs.writeFileSync(textPath, cleanText, 'utf8');

      const drawbox  = `drawbox=x=0:y=${marqueeY}:w=iw:h=${bandH}:color=black@0.65:t=fill`;
      const drawtext = `drawtext=${fp}textfile='${textPath}':fontsize=60:fontcolor=0xFFE600:x=w-mod(t*200\\,w+text_w):y=${marqueeY}+(${bandH}-text_h)/2`;

      filterComplex = [
        waves,
        waBadgeGen,
        `[0:v]${bgFilters}[vbase]`,
        `[vbase][eqv]overlay=x=0:y=${eqY}[with_eq]`,
        `[with_eq]${drawbox},${drawtext},${ctaBanner}[with_banner]`,
        `[with_banner][wacircle]overlay=x=${waX}:y=${waY}[with_badge]`,
        `[with_badge]${waContact}${assFilter}[vout]`,
      ].join(';');
    } else {
      filterComplex = [
        waves,
        waBadgeGen,
        `[0:v]${bgFilters}[vbase]`,
        `[vbase][eqv]overlay=x=0:y=${eqY}[with_eq]`,
        `[with_eq]${ctaBanner}[with_banner]`,
        `[with_banner][wacircle]overlay=x=${waX}:y=${waY}[with_badge]`,
        `[with_badge]${waContact}${assFilter}[vout]`,
      ].join(';');
    }

    const ANIM_LIMIT = 60; // segundos de animación completa
    const totalDuration = await getAudioDuration(finalAudio);
    console.log('[generate-sample-video] duración audio:', totalDuration.toFixed(1), 's');

    const videoArgs = [
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
      '-profile:v', 'main', '-level', '4.0', '-r', '15',
      '-pix_fmt', 'yuv420p',
    ];

    if (totalDuration <= ANIM_LIMIT) {
      // Audio corto: un solo pase animado completo
      await runFfmpeg([
        '-f', 'lavfi', '-i', `color=c=0x0d0005:r=15:s=${W}x${H}`,
        '-i', finalAudio,
        '-filter_complex', filterComplex,
        '-map', '[vout]', '-map', '1:a',
        ...videoArgs,
        '-c:a', 'aac', '-b:a', '96k',
        '-movflags', '+faststart', '-shortest',
        '-y', outputPath,
      ]);
    } else {
      // Audio largo: animado solo los primeros 60s, resto con frame estático
      const part1Path    = path.join(tmpDir, 'part1.mp4');
      const framePath    = path.join(tmpDir, 'lastframe.png');
      const part2Path    = path.join(tmpDir, 'part2.mp4');
      const filelistPath = path.join(tmpDir, 'filelist.txt');
      const remaining    = totalDuration - ANIM_LIMIT;

      // Parte 1: animación (60 s, solo video)
      await runFfmpeg([
        '-f', 'lavfi', '-i', `color=c=0x0d0005:r=15:s=${W}x${H}`,
        '-i', finalAudio,
        '-filter_complex', filterComplex,
        '-t', String(ANIM_LIMIT),
        '-map', '[vout]',
        ...videoArgs,
        '-an', '-y', part1Path,
      ]);

      // Extraer último frame de la parte animada
      await runFfmpeg(['-sseof', '-0.5', '-i', part1Path, '-vframes', '1', '-y', framePath]);

      // Parte 2: imagen estática (duración restante, solo video)
      await runFfmpeg([
        '-loop', '1', '-i', framePath,
        '-t', String(remaining),
        ...videoArgs,
        '-tune', 'stillimage',
        '-an', '-y', part2Path,
      ]);

      // Concatenar video + añadir audio completo (sin re-encodear video)
      fs.writeFileSync(filelistPath,
        `file '${part1Path}'\nfile '${part2Path}'\n`, 'utf8');
      await runFfmpeg([
        '-f', 'concat', '-safe', '0', '-i', filelistPath,
        '-i', finalAudio,
        '-map', '0:v', '-map', '1:a',
        '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '96k',
        '-movflags', '+faststart', '-shortest',
        '-y', outputPath,
      ]);
    }

    const videoBuffer = fs.readFileSync(outputPath);
    console.log('[generate-sample-video] listo:', (videoBuffer.length / 1024 / 1024).toFixed(2), 'MB');

    const safeName = text ? text.replace(/[^\w\s\-áéíóúüñÁÉÍÓÚÜÑ]/g, '').trim().slice(0, 60) : 'video';
    const encoded  = encodeURIComponent(`Muestra para ${safeName}.mp4`);

    return new NextResponse(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type':        'video/mp4',
        'Content-Disposition': `attachment; filename*=UTF-8''${encoded}`,
        'X-Watermark':         mixedAudio ? 'applied' : `skipped:${wmErrRef.msg.replace(/[\r\n]/g, '|').slice(0, 200)}`,
      },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[generate-sample-video] ERROR:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
    }
  }
}
