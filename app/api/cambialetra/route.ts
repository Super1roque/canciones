import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { transcribirPalabras, sintetizarVoz } from '@/lib/deepgramService';
import { pitchPromedio, pitchContorno, frecuenciaCercana, type FramePitch } from '@/lib/pitchTracker';
import { int16BufferToFloat32 } from '@/lib/audioPcm';
import { contentDisposition } from '@/lib/contentDisposition';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

const FFMPEG = ffmpegInstaller.path;
const SR = 24000;
// rubberband necesita varios cientos de ms de señal para "entrar en régimen":
// con fragmentos más cortos que esto destruye casi todo el contenido (medido
// empíricamente: un fragmento de 60ms queda reducido a ~7ms de audio real).
const MIN_SUBTRAMO_SEGUNDOS = 0.45;
const MAX_SUBTRAMOS = 3;
// Rangos "normales" que se aplican en la mayoría de los casos (amplios, para
// no romper el ritmo). Si el ajuste que haría falta es más extremo que esto,
// NO se fuerza — mejor una palabra un poco desalineada en tiempo/tono que
// rubberband destruyéndole las consonantes y dejando solo un resto de vocal
// tipo "hay" (así sonaban los casos extremos antes de este límite).
const TEMPO_RANGO: [number, number] = [0.5, 2.5];
const PITCH_RANGO: [number, number] = [0.6, 1.7];
const MAX_PALABRAS = 400;
const CONCURRENCIA = 5;

function limpiarAnotaciones(texto: string): string {
  return texto.replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ');
}

function calcularNumSubtramos(duracionObjetivo: number): number {
  if (duracionObjetivo < MIN_SUBTRAMO_SEGUNDOS * 2) return 1;
  return Math.max(1, Math.min(MAX_SUBTRAMOS, Math.floor(duracionObjetivo / MIN_SUBTRAMO_SEGUNDOS)));
}

// Devuelve el factor a aplicar, o 1 (sin ajuste) si el factor necesario cae
// fuera del rango seguro — preferible dejar la palabra tal cual a forzar un
// ajuste que rubberband no puede hacer sin destruir el contenido.
function factorSeguro(factorNecesario: number, [min, max]: [number, number]): number {
  return factorNecesario >= min && factorNecesario <= max ? factorNecesario : 1;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, args, { maxBuffer: 200 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) reject(new Error(stderr?.slice(-500) || err.message));
      else resolve();
    });
  });
}

async function conConcurrencia<T, R>(
  items: T[],
  limite: number,
  tarea: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const resultados: R[] = new Array(items.length);
  let siguiente = 0;
  async function trabajador() {
    while (siguiente < items.length) {
      const i = siguiente++;
      resultados[i] = await tarea(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, trabajador));
  return resultados;
}

// Concatena buffers PCM s16le mono con un breve crossfade lineal para
// disimular el salto entre sub-tramos procesados por separado.
function concatenarConCrossfade(buffers: Buffer[], sampleRate: number, crossfadeMs = 8): Buffer {
  if (buffers.length === 0) return Buffer.alloc(0);
  if (buffers.length === 1) return buffers[0];

  let resultado = buffers[0];
  const n = Math.round(sampleRate * crossfadeMs / 1000);

  for (let i = 1; i < buffers.length; i++) {
    const siguiente = buffers[i];
    const solape = Math.min(n, Math.floor(resultado.length / 2), Math.floor(siguiente.length / 2));
    if (solape <= 0) { resultado = Buffer.concat([resultado, siguiente]); continue; }

    const cabeza = resultado.subarray(0, resultado.length - solape * 2);
    const colaA = resultado.subarray(resultado.length - solape * 2);
    const colaB = siguiente.subarray(0, solape * 2);
    const restoB = siguiente.subarray(solape * 2);

    const mezclado = Buffer.alloc(solape * 2);
    for (let s = 0; s < solape; s++) {
      const t = s / solape;
      const v = Math.round(colaA.readInt16LE(s * 2) * (1 - t) + colaB.readInt16LE(s * 2) * t);
      mezclado.writeInt16LE(Math.max(-32768, Math.min(32767, v)), s * 2);
    }

    resultado = Buffer.concat([cabeza, mezclado, restoB]);
  }

  return resultado;
}

// Genera un tono que sigue la curva de tono del original entre [start,end]
// muestra a muestra (acumulando fase, sin saltos), en vez de sintetizar voz
// y tener que estirarla/afinarla con rubberband — así no hay ningún mínimo
// de duración ni artefactos: cualquier duración/frecuencia sale limpia.
function sintetizarTono(contorno: FramePitch[], start: number, end: number, sr: number, freqPorDefecto = 180): Buffer {
  const totalSamples = Math.max(1, Math.round((end - start) * sr));
  const out = Buffer.alloc(totalSamples * 2);
  const fadeSamples = Math.min(Math.floor(totalSamples / 2), Math.round(sr * 0.015));

  let fase = 0;
  let ultimaFreq = freqPorDefecto;
  for (let n = 0; n < totalSamples; n++) {
    const t = start + n / sr;
    const f = frecuenciaCercana(contorno, t) ?? ultimaFreq;
    ultimaFreq = f;
    fase += (2 * Math.PI * f) / sr;

    let amp = 0.55;
    if (n < fadeSamples) amp *= n / fadeSamples;
    if (n > totalSamples - fadeSamples) amp *= (totalSamples - n) / fadeSamples;

    out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(Math.sin(fase) * amp * 32767))), n * 2);
  }
  return out;
}

interface PalabraOriginal { start: number; end: number; }
interface PalabraDestino { texto: string; start: number; end: number; }

// Reparte un texto de longitud arbitraria (M palabras) sobre la línea de
// tiempo de las N palabras originales, usando la posición proporcional de
// cada palabra nueva (índice fraccional en [0,N]) interpolada sobre los
// bordes de tiempo originales. Así una palabra nueva "hereda" el tiempo de
// la franja original que le toca proporcionalmente, sin exigir que M == N.
function repartirTexto(textoLibre: string, original: PalabraOriginal[]): PalabraDestino[] {
  const nuevas = textoLibre.trim().split(/\s+/).filter(Boolean);
  const N = original.length;
  const M = nuevas.length;
  if (N === 0 || M === 0) return [];

  const T = original.map(w => w.start);
  T.push(original[N - 1].end);

  const tiempoEn = (f: number): number => {
    const i = Math.min(Math.floor(f), N - 1);
    const frac = f - i;
    return T[i] + frac * (T[i + 1] - T[i]);
  };

  const bordes = Array.from({ length: M + 1 }, (_, k) => tiempoEn((k * N) / M));
  return nuevas.map((texto, j) => ({ texto, start: bordes[j], end: bordes[j + 1] }));
}

export async function POST(request: Request) {
  let tmpDir: string | null = null;
  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const textoLibre = form.get('texto') as string | null;
    const modo = form.get('modo') === 'tono' ? 'tono' : 'voz';

    if (!file) return Response.json({ error: 'Falta el archivo de audio' }, { status: 400 });
    if (modo === 'voz' && !textoLibre?.trim()) {
      return Response.json({ error: 'Falta el texto de reemplazo' }, { status: 400 });
    }

    const audioBuffer = await file.arrayBuffer();
    const contentType = file.type || 'audio/mpeg';

    const transcripcion = await transcribirPalabras(audioBuffer, contentType);
    if ('error' in transcripcion) return Response.json({ error: transcripcion.error }, { status: 422 });
    const { cues } = transcripcion;

    const palabras = modo === 'voz' ? repartirTexto(limpiarAnotaciones(textoLibre!), cues) : [];
    if (modo === 'voz' && palabras.length === 0) {
      return Response.json({ error: 'No se pudo repartir el texto sobre la línea de tiempo del audio' }, { status: 422 });
    }
    if (modo === 'voz' && palabras.length > MAX_PALABRAS) {
      return Response.json({ error: `El texto tiene demasiadas palabras (máximo ${MAX_PALABRAS})` }, { status: 400 });
    }

    tmpDir = join(tmpdir(), `cambialetra_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    await mkdir(tmpDir, { recursive: true });

    // Decodificar el audio original completo para extraer su curva de tono
    const extension = (file.name.match(/\.[^.]+$/)?.[0] || '.mp3').toLowerCase();
    const inPath = join(tmpDir, `in${extension}`);
    await writeFile(inPath, Buffer.from(audioBuffer));

    const origRawPath = join(tmpDir, 'orig.raw');
    await runFfmpeg(['-y', '-i', inPath, '-f', 's16le', '-ar', String(SR), '-ac', '1', origRawPath]);
    const contorno = pitchContorno(int16BufferToFloat32(await readFile(origRawPath)), SR);

    // Modo "tono": sin TTS ni rubberband — por cada palabra del ORIGINAL se
    // genera directamente un tono que sigue la curva de entonación real en
    // ese tramo. No hay palabras nuevas, es un tarareo del tono original.
    if (modo === 'tono') {
      const duracionTotal = Math.max(...cues.map(c => c.end)) + 1;
      const totalSamples = Math.round(duracionTotal * SR);
      const pista = Buffer.alloc(totalSamples * 2);

      for (const cue of cues) {
        const tono = sintetizarTono(contorno, cue.start, cue.end, SR);
        const offsetBytes = Math.max(0, Math.round(cue.start * SR)) * 2;
        const bytesACopiar = Math.min(tono.length, pista.length - offsetBytes);
        if (bytesACopiar > 0) tono.copy(pista, offsetBytes, 0, bytesACopiar);
      }

      const pistaPath = join(tmpDir, 'tono.raw');
      await writeFile(pistaPath, pista);

      const outputPath = join(tmpDir, 'final.mp3');
      await runFfmpeg([
        '-f', 's16le', '-ar', String(SR), '-ac', '1', '-i', pistaPath,
        '-c:a', 'libmp3lame', '-b:a', '192k', '-y', outputPath,
      ]);

      const finalBuffer = await readFile(outputPath);
      const name = file.name.replace(/\.[^.]+$/, '') + '_tono.mp3';

      return new Response(finalBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': contentDisposition(name),
          'Content-Length': String(finalBuffer.length),
        },
      });
    }

    async function procesarPalabra(p: PalabraDestino, i: number): Promise<{ path: string; startMs: number } | null> {
      const duracionObjetivo = Math.max(0.15, p.end - p.start);

      const ttsBuffer = await sintetizarVoz(p.texto, { sampleRate: SR });
      const pcmBuf = Buffer.from(ttsBuffer);
      const duracionActual = pcmBuf.length / 2 / SR;
      if (duracionActual <= 0) return null;

      // 1. Ajustar tempo a la duración objetivo (el tono se afina después, por
      // sub-tramo). Si el factor necesario es demasiado extremo, no se fuerza
      // — se deja la palabra a su duración natural del TTS.
      const tempoFactor = factorSeguro(duracionActual / duracionObjetivo, TEMPO_RANGO);
      const rawTtsPath = join(tmpDir!, `w${i}_tts.raw`);
      await writeFile(rawTtsPath, pcmBuf);

      const tempoPath = join(tmpDir!, `w${i}_tempo.raw`);
      if (Math.abs(tempoFactor - 1) < 0.01) {
        await writeFile(tempoPath, pcmBuf);
      } else {
        await runFfmpeg([
          '-f', 's16le', '-ar', String(SR), '-ac', '1', '-i', rawTtsPath,
          '-af', `rubberband=tempo=${tempoFactor.toFixed(6)}`,
          '-f', 's16le', '-ar', String(SR), '-ac', '1', '-y', tempoPath,
        ]);
      }

      const tempoPcm = await readFile(tempoPath);
      const tempoFrames = Math.floor(tempoPcm.length / 2);
      if (tempoFrames === 0) return null;

      // 2. Solo las palabras/notas largas se trocean en sub-tramos para
      //    afinar cada uno al tono que tenía el audio original en el instante
      //    proporcional correspondiente (curva de entonación). El umbral se
      //    calcula sobre la duración REAL post-tempo, no la objetivo.
      const duracionReal = tempoFrames / SR;
      const numSubtramos = calcularNumSubtramos(duracionReal);
      const framesPorTramo = Math.ceil(tempoFrames / numSubtramos);

      const subBuffers: Buffer[] = [];
      for (let s = 0; s < numSubtramos; s++) {
        const frameIni = s * framesPorTramo;
        const frameFin = Math.min(frameIni + framesPorTramo, tempoFrames);
        if (frameIni >= frameFin) continue;

        const subBuf = tempoPcm.subarray(frameIni * 2, frameFin * 2);
        const fuenteHz = pitchPromedio(int16BufferToFloat32(subBuf), SR);

        const propMedio = (s + 0.5) / numSubtramos;
        const tOriginal = p.start + propMedio * (p.end - p.start);
        const objetivoHz = frecuenciaCercana(contorno, tOriginal);

        const pitchFactor = fuenteHz && objetivoHz ? factorSeguro(objetivoHz / fuenteHz, PITCH_RANGO) : 1;

        if (Math.abs(pitchFactor - 1) < 0.01) {
          subBuffers.push(Buffer.from(subBuf));
          continue;
        }

        const subInPath = join(tmpDir!, `w${i}_s${s}.raw`);
        const subOutPath = join(tmpDir!, `w${i}_s${s}_p.raw`);
        await writeFile(subInPath, subBuf);
        await runFfmpeg([
          '-f', 's16le', '-ar', String(SR), '-ac', '1', '-i', subInPath,
          '-af', `rubberband=pitch=${pitchFactor.toFixed(6)}`,
          '-f', 's16le', '-ar', String(SR), '-ac', '1', '-y', subOutPath,
        ]);
        subBuffers.push(await readFile(subOutPath));
      }

      const wordFinal = concatenarConCrossfade(subBuffers, SR);
      const wordRawPath = join(tmpDir!, `w${i}_final.raw`);
      await writeFile(wordRawPath, wordFinal);

      return { path: wordRawPath, startMs: Math.max(0, Math.round(p.start * 1000)) };
    }

    const resultados = await conConcurrencia(palabras, CONCURRENCIA, procesarPalabra);
    const clips = resultados.filter((c): c is { path: string; startMs: number } => c !== null);

    if (clips.length === 0) {
      return Response.json({ error: 'No se pudo sintetizar ninguna palabra' }, { status: 500 });
    }

    // Mezclar todos los clips en la línea de tiempo original
    const duracionTotal = Math.max(...cues.map(c => c.end)) + 1;

    const inputArgs: string[] = [];
    clips.forEach(c => inputArgs.push('-f', 's16le', '-ar', String(SR), '-ac', '1', '-i', c.path));

    const delays = clips.map((c, i) => `[${i}:a]adelay=${c.startMs}|${c.startMs}[a${i}]`).join(';');
    const mixInputs = clips.map((_, i) => `[a${i}]`).join('');
    const muestrasObjetivo = Math.round(duracionTotal * SR);
    const filterComplex =
      `${delays};${mixInputs}amix=inputs=${clips.length}:duration=longest:dropout_transition=0[mixed];` +
      `[mixed]volume=${clips.length},alimiter=limit=0.95[limited];` +
      `[limited]apad=whole_len=${muestrasObjetivo}[out]`;

    const outputPath = join(tmpDir, 'final.mp3');
    await runFfmpeg([
      ...inputArgs,
      '-filter_complex', filterComplex,
      '-map', '[out]',
      '-c:a', 'libmp3lame', '-b:a', '192k',
      '-y', outputPath,
    ]);

    const finalBuffer = await readFile(outputPath);
    const name = file.name.replace(/\.[^.]+$/, '') + '_cambialetra.mp3';

    return new Response(finalBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
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
