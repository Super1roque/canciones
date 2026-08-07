import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { contentDisposition } from '@/lib/contentDisposition';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FFMPEG = ffmpegInstaller.path;
const SAMPLE_RATE = 44100;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2;
const FRAME_SIZE = CHANNELS * BYTES_PER_SAMPLE;
const GAP_SECONDS = 0.5;
const INTERVALOS_SEGUNDOS = [1.5, 2, 5];

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, args, { maxBuffer: 300 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) reject(new Error(stderr?.slice(-500) || err.message));
      else resolve();
    });
  });
}

// Equivalente a un tremolo de onda cuadrada con Depth al 100%: en vez de
// insertar tiempo extra, silencia (amplitud 0) tramos de GAP_SECONDS en el
// lugar, en puntos separados por intervalos aleatorios (1.5s / 2s / 5s). El
// corte es abrupto (sin fade), como el "switch" de una onda cuadrada real.
// La duración del audio no cambia.
function aplicarGateOndaCuadrada(pcm: Buffer): Buffer {
  const totalFrames = Math.floor(pcm.length / FRAME_SIZE);
  const duracionSegundos = totalFrames / SAMPLE_RATE;
  const gapFrames = Math.round(GAP_SECONDS * SAMPLE_RATE);

  const salida = Buffer.from(pcm);
  let t = INTERVALOS_SEGUNDOS[Math.floor(Math.random() * INTERVALOS_SEGUNDOS.length)];

  while (t < duracionSegundos) {
    const frameInicio = Math.round(t * SAMPLE_RATE);
    const frameFin = Math.min(frameInicio + gapFrames, totalFrames);
    if (frameInicio < totalFrames) {
      salida.fill(0, frameInicio * FRAME_SIZE, frameFin * FRAME_SIZE);
    }
    t += INTERVALOS_SEGUNDOS[Math.floor(Math.random() * INTERVALOS_SEGUNDOS.length)];
  }

  return salida;
}

export async function POST(request: Request) {
  let tmpDir: string | null = null;
  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    if (!file) return Response.json({ error: 'Falta el archivo de audio' }, { status: 400 });

    tmpDir = join(tmpdir(), `intervalos_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    await mkdir(tmpDir, { recursive: true });

    const extension = (file.name.match(/\.[^.]+$/)?.[0] || '.mp3').toLowerCase();
    const inPath = join(tmpDir, `in${extension}`);
    await writeFile(inPath, Buffer.from(await file.arrayBuffer()));

    // Decodificar a PCM crudo para poder aplicar el gate con precisión de muestra
    const rawInPath = join(tmpDir, 'in.raw');
    await runFfmpeg(['-y', '-i', inPath, '-f', 's16le', '-ar', String(SAMPLE_RATE), '-ac', String(CHANNELS), rawInPath]);

    const pcm = await readFile(rawInPath);
    const pcmConGate = aplicarGateOndaCuadrada(pcm);

    const rawOutPath = join(tmpDir, 'out.raw');
    await writeFile(rawOutPath, pcmConGate);

    const outPath = join(tmpDir, 'out.ogg');
    await runFfmpeg([
      '-f', 's16le', '-ar', String(SAMPLE_RATE), '-ac', String(CHANNELS), '-i', rawOutPath,
      '-c:a', 'libvorbis', '-q:a', '5', '-y', outPath,
    ]);

    const finalBuffer = await readFile(outPath);
    const name = file.name.replace(/\.[^.]+$/, '') + '_intervalos.ogg';

    return new Response(finalBuffer, {
      headers: {
        'Content-Type': 'audio/ogg',
        'Content-Disposition': contentDisposition(name),
        'Content-Length': String(finalBuffer.length),
      },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Error al procesar' }, { status: 500 });
  } finally {
    if (tmpDir) try { await rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
}
