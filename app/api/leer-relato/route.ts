import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { sintetizarVoz, transcribirPalabras } from '@/lib/deepgramService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

const FFMPEG = ffmpegInstaller.path;
const SR = 24000;
const MAX_TEXTO = 20000; // relato completo — más que esto, mejor partirlo en varias lecturas
// Aura TTS no acepta un texto arbitrariamente largo por pedido — se trocea
// respetando fin de oración, nunca a mitad de palabra. Cada oración se
// sintetiza en su propia llamada para poder insertar el silencio real entre
// ellas después — Aura-2 no pausa de forma confiable solo con el punto.
const MAX_CHARS_POR_ORACION = 1600;
const SILENCIO_ENTRE_ORACIONES_MS = 350;
// Un relato largo puede partirse en decenas de oraciones — pedirlas todas
// en paralelo dispara un 429 (rate limit) de Deepgram. Con esto como
// mucho hay CONCURRENCIA_TTS llamadas de TTS en vuelo a la vez.
const CONCURRENCIA_TTS = 4;

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, args, { maxBuffer: 200 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) reject(new Error(stderr?.slice(-500) || err.message));
      else resolve();
    });
  });
}

// Parte el texto en oraciones individuales (por punto/signo de cierre).
// Si una oración sin puntuación intermedia supera el límite de la API, se
// subdivide por palabras — nunca a mitad de una — como único caso de
// respaldo (pasa solo con texto sin puntuación).
function trocearEnOraciones(texto: string, maxChars: number): string[] {
  const oracionesCrudas = texto
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) ?? [texto];

  const oraciones: string[] = [];
  for (const oracionCruda of oracionesCrudas) {
    const oracion = oracionCruda.trim();
    if (!oracion) continue;
    if (oracion.length <= maxChars) {
      oraciones.push(oracion);
      continue;
    }
    const palabras = oracion.split(' ');
    let actual = '';
    for (const palabra of palabras) {
      if (actual && (actual.length + palabra.length + 1) > maxChars) {
        oraciones.push(actual);
        actual = '';
      }
      actual += (actual ? ' ' : '') + palabra;
    }
    if (actual) oraciones.push(actual);
  }
  return oraciones;
}

function silencioPcm(ms: number, sr: number): Buffer {
  return Buffer.alloc(Math.round((ms / 1000) * sr) * 2);
}

// Como Promise.all pero con un tope de tareas en vuelo a la vez, y
// preservando el orden de los resultados.
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
      return Response.json({ error: `El texto es muy largo (máximo ${MAX_TEXTO} caracteres) — partilo en varias lecturas` }, { status: 400 });
    }

    const oraciones = trocearEnOraciones(texto, MAX_CHARS_POR_ORACION);
    if (oraciones.length === 0) {
      return Response.json({ error: 'No se pudo procesar el texto' }, { status: 400 });
    }

    // Una llamada a TTS por oración, con concurrencia limitada — el
    // silencio entre ellas lo controlamos nosotros al concatenar, no Aura.
    const audiosOraciones = await mapConcurrencia(
      oraciones, CONCURRENCIA_TTS, oracion => sintetizarVoz(oracion, { voz, sampleRate: SR })
    );

    const buffers: Buffer[] = [];
    audiosOraciones.forEach((audio, i) => {
      buffers.push(Buffer.from(audio));
      if (i < audiosOraciones.length - 1) buffers.push(silencioPcm(SILENCIO_ENTRE_ORACIONES_MS, SR));
    });
    const pcmCompleto = Buffer.concat(buffers);

    tmpDir = join(tmpdir(), `leer_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    await mkdir(tmpDir, { recursive: true });

    const rawPath = join(tmpDir, 'audio.raw');
    const mp3Path = join(tmpDir, 'audio.mp3');
    await writeFile(rawPath, pcmCompleto);
    await runFfmpeg([
      '-f', 's16le', '-ar', String(SR), '-ac', '1', '-i', rawPath,
      '-c:a', 'libmp3lame', '-b:a', '128k', '-y', mp3Path,
    ]);
    const mp3Buffer = await readFile(mp3Path);

    // Se transcribe el MP3 YA GENERADO (no se analiza el texto original)
    // para sacar los tiempos reales de cada palabra — mismo mecanismo que
    // ya usa el resto de la app para sincronizar letras con el audio
    // (mismo content-type que usa el upload de canciones-compartidas).
    const transcripcion = await transcribirPalabras(
      mp3Buffer.buffer.slice(mp3Buffer.byteOffset, mp3Buffer.byteOffset + mp3Buffer.byteLength) as ArrayBuffer,
      'audio/mpeg'
    );
    if ('error' in transcripcion) {
      return Response.json({ error: `No se pudo sincronizar el texto: ${transcripcion.error}` }, { status: 422 });
    }

    return Response.json({
      audio: mp3Buffer.toString('base64'),
      contentType: 'audio/mpeg',
      cues: transcripcion.cues,
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Error al generar la lectura' }, { status: 500 });
  } finally {
    if (tmpDir) try { await rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
}
