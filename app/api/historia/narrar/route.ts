import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { sintetizarVoz } from '@/lib/deepgramService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Lectura en voz de UNA respuesta de Mi Historia, para la página de
// Memoria (/historia/[clave]/memoria) — es una versión liviana de
// /api/leer-relato: genera el audio y listo, SIN el paso final de
// re-transcribir con Whisper para sacar tiempos por palabra (eso es para
// sincronizar texto resaltado, cosa que Memoria no hace — solo reproduce
// el audio). Ese paso de más es justo lo que hacía lenta/colgada la
// respuesta cuando se probó reusando /api/leer-relato tal cual.
const FFMPEG = ffmpegInstaller.path;
const SR = 24000;
const MAX_TEXTO = 8000;
const MAX_CHARS_POR_ORACION = 1600;
const SILENCIO_ENTRE_ORACIONES_MS = 200;
const CONCURRENCIA_TTS = 4;

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, args, { maxBuffer: 200 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) reject(new Error(stderr?.slice(-500) || err.message));
      else resolve();
    });
  });
}

function trocearEnOraciones(texto: string, maxChars: number): string[] {
  const oracionesCrudas = texto
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) ?? [texto];

  const oraciones: string[] = [];
  for (const oracionCruda of oracionesCrudas) {
    const oracion = oracionCruda.trim();
    if (!oracion) continue;
    if (oracion.length <= maxChars) { oraciones.push(oracion); continue; }
    const palabras = oracion.split(' ');
    let actual = '';
    for (const palabra of palabras) {
      if (actual && (actual.length + palabra.length + 1) > maxChars) { oraciones.push(actual); actual = ''; }
      actual += (actual ? ' ' : '') + palabra;
    }
    if (actual) oraciones.push(actual);
  }
  return oraciones;
}

function silencioPcm(ms: number, sr: number): Buffer {
  return Buffer.alloc(Math.round((ms / 1000) * sr) * 2);
}

async function mapConcurrencia<T, R>(items: T[], limite: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = new Array(items.length);
  let siguiente = 0;
  async function trabajador() {
    while (siguiente < items.length) {
      const i = siguiente++;
      resultados[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, trabajador));
  return resultados;
}

export async function POST(request: Request) {
  let tmpDir: string | null = null;
  try {
    const { texto, voz } = await request.json();

    if (!texto || typeof texto !== 'string' || !texto.trim()) {
      return Response.json({ error: 'Falta el texto a leer' }, { status: 400 });
    }
    if (texto.length > MAX_TEXTO) {
      return Response.json({ error: `El texto es muy largo (máximo ${MAX_TEXTO} caracteres)` }, { status: 400 });
    }

    const oraciones = trocearEnOraciones(texto, MAX_CHARS_POR_ORACION);
    if (oraciones.length === 0) {
      return Response.json({ error: 'No se pudo procesar el texto' }, { status: 400 });
    }

    const audiosOraciones = await mapConcurrencia(
      oraciones, CONCURRENCIA_TTS, oracion => sintetizarVoz(oracion, { voz, sampleRate: SR })
    );

    const buffers: Buffer[] = [];
    audiosOraciones.forEach((audio, i) => {
      buffers.push(Buffer.from(audio));
      if (i < audiosOraciones.length - 1) buffers.push(silencioPcm(SILENCIO_ENTRE_ORACIONES_MS, SR));
    });
    const pcmCompleto = Buffer.concat(buffers);

    tmpDir = join(tmpdir(), `narrar_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    await mkdir(tmpDir, { recursive: true });

    const rawPath = join(tmpDir, 'audio.raw');
    const mp3Path = join(tmpDir, 'audio.mp3');
    await writeFile(rawPath, pcmCompleto);
    await runFfmpeg([
      '-f', 's16le', '-ar', String(SR), '-ac', '1', '-i', rawPath,
      '-c:a', 'libmp3lame', '-b:a', '128k', '-y', mp3Path,
    ]);
    const mp3Buffer = await readFile(mp3Path);

    return Response.json({ audio: mp3Buffer.toString('base64'), contentType: 'audio/mpeg' });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Error al generar el audio' }, { status: 500 });
  } finally {
    if (tmpDir) try { await rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
}
