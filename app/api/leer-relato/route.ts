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
// respetando fin de oración, nunca a mitad de palabra.
const MAX_CHARS_POR_TRAMO = 1600;
const SILENCIO_ENTRE_TRAMOS_MS = 150;

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, args, { maxBuffer: 200 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) reject(new Error(stderr?.slice(-500) || err.message));
      else resolve();
    });
  });
}

// Parte el texto en oraciones (por punto/signo de cierre + espacio) y las
// va empacando en tramos que no superen el límite de caracteres — así
// nunca corta una oración a la mitad, solo agrupa varias completas por
// tramo hasta llenar el cupo.
function trocearEnOraciones(texto: string, maxChars: number): string[] {
  const oraciones = texto
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) ?? [texto];

  const tramos: string[] = [];
  let actual = '';
  for (const oracion of oraciones) {
    if (actual && (actual.length + oracion.length) > maxChars) {
      tramos.push(actual.trim());
      actual = '';
    }
    // Una sola oración más larga que el máximo — se manda sola, no hay
    // forma de partirla sin cortar a mitad de palabra de forma más fina.
    actual += oracion;
  }
  if (actual.trim()) tramos.push(actual.trim());
  return tramos;
}

function silencioPcm(ms: number, sr: number): Buffer {
  return Buffer.alloc(Math.round((ms / 1000) * sr) * 2);
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

    const tramos = trocearEnOraciones(texto, MAX_CHARS_POR_TRAMO);
    if (tramos.length === 0) {
      return Response.json({ error: 'No se pudo procesar el texto' }, { status: 400 });
    }

    const buffers: Buffer[] = [];
    for (let i = 0; i < tramos.length; i++) {
      const ttsBuffer = await sintetizarVoz(tramos[i], { voz, sampleRate: SR });
      buffers.push(Buffer.from(ttsBuffer));
      if (i < tramos.length - 1) buffers.push(silencioPcm(SILENCIO_ENTRE_TRAMOS_MS, SR));
    }
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
