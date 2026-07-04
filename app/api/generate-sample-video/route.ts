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

function findFont(): string | null {
  for (const f of FONT_CANDIDATES) if (fs.existsSync(f)) return f;
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

    const outputPath  = path.join(tmpDir, 'output.mp4');
    const wmErrRef    = { msg: '' };
    const mixedAudio  = await applyWatermarkAudio(audioPath, tmpDir, wmErrRef);
    const finalAudio  = mixedAudio !== null ? mixedAudio : audioPath;
    console.log('[generate-sample-video] audio final:', mixedAudio ? 'CON marca de agua' : `SIN marca de agua: ${wmErrRef.msg}`);

    const font = findFont();
    console.log('[generate-sample-video] fuente:', font);
    const fp = font ? `fontfile='${font}':` : '';

    const eqH   = 150;
    const bandH = 180;
    const eqY   = H - bandH - eqH;

    // Rótulo CTA estático multi-línea en la parte superior
    const ctaText = 'OBTENGA ESTA CANCION\nPOR LA SUMA DE 500.00 LEMPIRAS\nPIDA MAS DETALLES AL 9689-5978';
    const ctaPath = path.join(tmpDir, 'cta.txt');
    fs.writeFileSync(ctaPath, ctaText, 'utf8');
    const ctaY = 54;
    const ctaH = 200;
    const ctaCta = [
      `drawbox=x=0:y=${ctaY}:w=iw:h=${ctaH}:color=0xAA0000@0.93:t=fill`,
      `drawbox=x=0:y=${ctaY}:w=iw:h=7:color=0xFFD700:t=fill`,
      `drawbox=x=0:y=${ctaY + ctaH - 7}:w=iw:h=7:color=0xFFD700:t=fill`,
      `drawtext=${fp}textfile='${ctaPath}':fontsize=50:fontcolor=0xFFE600:x=(w-text_w)/2:y=${ctaY}+(${ctaH}-text_h)/2:line_spacing=10:shadowcolor=0x000000@0.85:shadowx=3:shadowy=3`,
    ].join(',');

    // Fondo animado estilo mariachi/corrido
    const bgFilters = [
      // Franjas bandera mexicana — borde superior
      `drawbox=x=0:y=0:w=iw:h=18:color=0x006600:t=fill`,
      `drawbox=x=0:y=18:w=iw:h=18:color=0xEEEEEE@0.6:t=fill`,
      `drawbox=x=0:y=36:w=iw:h=18:color=0xCC0000:t=fill`,
      // Franjas bandera mexicana — borde inferior
      `drawbox=x=0:y=ih-54:w=iw:h=18:color=0x006600:t=fill`,
      `drawbox=x=0:y=ih-36:w=iw:h=18:color=0xEEEEEE@0.6:t=fill`,
      `drawbox=x=0:y=ih-18:w=iw:h=18:color=0xCC0000:t=fill`,
      // Rayos de escenario oscilantes
      `drawbox=x='sin(t/3)*300+200':y=0:w=100:h=ih:color=0xFF6B00@0.12:t=fill`,
      `drawbox=x='sin(t/4+1)*300+500':y=0:w=80:h=ih:color=0xCC0000@0.10:t=fill`,
      `drawbox=x='sin(t/5+2)*300+800':y=0:w=100:h=ih:color=0xFFD700@0.10:t=fill`,
      `drawbox=x='sin(t/3.5+3)*300+350':y=0:w=60:h=ih:color=0x006600@0.08:t=fill`,
      `drawbox=x='sin(t/2.5+4)*350+540':y=0:w=70:h=ih:color=0xFFFFFF@0.04:t=fill`,
      `drawbox=x='sin(t/6+5)*280+700':y=0:w=50:h=ih:color=0xFF6B00@0.07:t=fill`,
      // Líneas horizontales barriendo (luces de piso)
      `drawbox=x=0:y='mod(t*50\\,1920)':w=iw:h=3:color=0xFFD700@0.18:t=fill`,
      `drawbox=x=0:y='mod(t*50+640\\,1920)':w=iw:h=3:color=0xCC0000@0.14:t=fill`,
      `drawbox=x=0:y='mod(t*50+1280\\,1920)':w=iw:h=3:color=0x006600@0.14:t=fill`,
      // Notas musicales flotando
      `drawtext=${fp}text='♪':fontsize=200:fontcolor=0xFFD700@0.25:x=100:y='mod(1920-t*80\\,2200)-300'`,
      `drawtext=${fp}text='♫':fontsize=160:fontcolor=0xCC0000@0.20:x=750:y='mod(1920-t*65+400\\,2200)-300'`,
      `drawtext=${fp}text='♪':fontsize=140:fontcolor=0x00AA00@0.18:x=400:y='mod(1920-t*75+800\\,2200)-300'`,
      `drawtext=${fp}text='♬':fontsize=180:fontcolor=0xFFD700@0.22:x=880:y='mod(1920-t*55+1200\\,2200)-300'`,
      `drawtext=${fp}text='♩':fontsize=120:fontcolor=0xCC0000@0.18:x=600:y='mod(1920-t*90+300\\,2200)-300'`,
      `drawtext=${fp}text='♫':fontsize=150:fontcolor=0x00AA00@0.16:x=250:y='mod(1920-t*70+1600\\,2200)-300'`,
      // Asteriscos como estrellas de escenario flotando
      `drawtext=${fp}text='*':fontsize=130:fontcolor=0xFFD700@0.35:x=550:y='mod(1920-t*40+600\\,2100)-200'`,
      `drawtext=${fp}text='*':fontsize=90:fontcolor=0xFFFFFF@0.25:x=300:y='mod(1920-t*35+1100\\,2100)-200'`,
      `drawtext=${fp}text='*':fontsize=110:fontcolor=0xCC0000@0.28:x=820:y='mod(1920-t*45+1700\\,2100)-200'`,
      `vignette=PI/3`,
    ].join(',');

    const marqueeY = 1000;

    const waves = `[1:a]showwaves=s=${W}x${eqH}:mode=cline:colors=0xFF7316:draw=full:scale=sqrt[eqv]`;

    let filterComplex: string;

    if (text) {
      const cleanText = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
      const textPath  = path.join(tmpDir, 'overlay.txt');
      fs.writeFileSync(textPath, cleanText, 'utf8');

      const drawbox  = `drawbox=x=0:y=${marqueeY}:w=iw:h=${bandH}:color=black@0.65:t=fill`;
      const drawtext = `drawtext=${fp}textfile='${textPath}':fontsize=90:fontcolor=0xFFE600:x=w-mod(t*200\\,w+text_w):y=${marqueeY}+(${bandH}-text_h)/2`;

      filterComplex = [
        waves,
        `[0:v]${bgFilters}[vbase]`,
        `[vbase][eqv]overlay=x=0:y=${eqY}[with_eq]`,
        `[with_eq]${drawbox},${drawtext},${ctaCta}[vout]`,
      ].join(';');
    } else {
      filterComplex = [
        waves,
        `[0:v]${bgFilters}[vbase]`,
        `[vbase][eqv]overlay=x=0:y=${eqY}[with_eq]`,
        `[with_eq]${ctaCta}[vout]`,
      ].join(';');
    }

    await runFfmpeg([
      '-f', 'lavfi', '-i', `color=c=0x0d0005:r=5:s=${W}x${H}`,
      '-i', finalAudio,
      '-filter_complex', filterComplex,
      '-map', '[vout]',
      '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-r', '5',
      '-c:a', 'aac', '-b:a', '128k',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-shortest',
      '-y', outputPath,
    ]);

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
