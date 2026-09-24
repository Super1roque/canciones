import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { transcribirPalabras, sintetizarVoz } from '@/lib/deepgramService';
import { pitchPromedio, pitchContorno, frecuenciaCercana, freqToSemitones, type FramePitch } from '@/lib/pitchTracker';
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
function sintetizarTono(contorno: FramePitch[], start: number, end: number, sr: number, freqPorDefecto = 180, amplitud = 0.55): Buffer {
  const totalSamples = Math.max(1, Math.round((end - start) * sr));
  const out = Buffer.alloc(totalSamples * 2);

  // Si en todo este tramo no se detectó ningún tono real en el original
  // (silencio, respiración, o una "palabra" alucinada por la transcripción
  // en una zona sin voz — común en los primeros segundos), no generar
  // sonido: antes se rellenaba con la frecuencia por defecto y sonaba como
  // un zumbido inventado en lo que debería ser silencio.
  const hayTonoReal = contorno.some(p => p.freq !== null && p.time >= start && p.time < end);
  if (!hayTonoReal) return out;

  const fadeSamples = Math.min(Math.floor(totalSamples / 2), Math.round(sr * 0.015));

  let fase = 0;
  let ultimaFreq = freqPorDefecto;
  for (let n = 0; n < totalSamples; n++) {
    const t = start + n / sr;
    const f = frecuenciaCercana(contorno, t) ?? ultimaFreq;
    ultimaFreq = f;
    fase += (2 * Math.PI * f) / sr;

    let amp = amplitud;
    if (n < fadeSamples) amp *= n / fadeSamples;
    if (n > totalSamples - fadeSamples) amp *= (totalSamples - n) / fadeSamples;

    out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(Math.sin(fase) * amp * 32767))), n * 2);
  }
  return out;
}

// Vuelca una pista PCM s16le mono a MP3 — usado por el modo "tono"
// (tararea la voz).
async function pistaAMp3(pista: Buffer, sr: number, tmpDir: string) {
  const pistaPath = join(tmpDir, 'tono.raw');
  await writeFile(pistaPath, pista);
  const outputPath = join(tmpDir, 'final.mp3');
  await runFfmpeg([
    '-f', 's16le', '-ar', String(sr), '-ac', '1', '-i', pistaPath,
    '-c:a', 'libmp3lame', '-b:a', '192k', '-y', outputPath,
  ]);
  return readFile(outputPath);
}

// Modo "guía": mezcla el tarareo (palabras/huecos) POR ENCIMA del audio
// ORIGINAL de verdad (bajado de volumen), en vez de entregar solo el tono
// sintético solo — así se escucha la canción real con una guía de
// entonación resaltada por arriba, como una pista de karaoke. El original
// manda la duración total (duration=first) — si el tarareo termina antes
// (ej. la canción sigue con un outro instrumental sin palabras), el resto
// sigue sonando con el original solo.
async function mezclarConOriginal(pista: Buffer, sr: number, audioOriginalPath: string, tmpDir: string) {
  const pistaPath = join(tmpDir, 'guia_tono.raw');
  await writeFile(pistaPath, pista);
  const outputPath = join(tmpDir, 'final_guia.mp3');
  const filterComplex =
    `[0:a]volume=0.35,aformat=sample_rates=${sr}:channel_layouts=mono[bg];` +
    `[1:a]volume=1.4,aformat=sample_rates=${sr}:channel_layouts=mono[fg];` +
    `[bg][fg]amix=inputs=2:duration=first:dropout_transition=0[mixed];` +
    `[mixed]alimiter=limit=0.95[out]`;
  await runFfmpeg([
    '-i', audioOriginalPath,
    '-f', 's16le', '-ar', String(sr), '-ac', '1', '-i', pistaPath,
    '-filter_complex', filterComplex,
    '-map', '[out]',
    '-c:a', 'libmp3lame', '-b:a', '192k',
    '-y', outputPath,
  ]);
  return readFile(outputPath);
}

// Mismo hop que usa pitchContorno (lib/pitchTracker.ts) — hardcodeado ahí,
// se repite acá para no exportar un detalle interno solo por esto.
const HOP_CONTORNO = 0.02;
// Diferencia de tono, en semitonos, a partir de la cual se considera que
// dentro de la palabra empezó una entonación distinta (y no que la misma
// nota tiene vibrato/ligero desafine). 0.7 semitonos es bastante menos que
// un semitono completo, para no perder movimientos de tono reales pero sin
// cortar de más por vibrato.
const UMBRAL_SEMITONOS_NOTA = 0.7;

interface NotaDetectada { start: number; end: number; }

// Divide el tramo [start,end) de UNA palabra en sub-notas según los saltos
// de tono reales dentro de ella — cantar "tengo" (tono estable) se tararea
// como una sola nota, pero "teeeeeennngo" (que sube/baja mientras se
// sostiene) se parte en varias, cada una en su propia frecuencia, en vez de
// un solo glissando continuo que difumina el movimiento real de la voz.
function segmentarNotasEnPalabra(contorno: FramePitch[], start: number, end: number): NotaDetectada[] {
  const notas: NotaDetectada[] = [];
  let inicio: number | null = null;
  let freqRef: number | null = null;
  let ultimoConTono: number | null = null;

  for (const p of contorno) {
    if (p.time < start) continue;
    if (p.time >= end) break;

    if (p.freq === null) {
      // Un hueco breve (glitch de detección, típico en autocorrelación) se
      // ignora; uno más largo que un par de frames cierra la nota actual.
      if (inicio !== null && ultimoConTono !== null && p.time - ultimoConTono > HOP_CONTORNO * 2) {
        notas.push({ start: inicio, end: ultimoConTono + HOP_CONTORNO });
        inicio = null;
        freqRef = null;
      }
      continue;
    }
    if (inicio === null) {
      inicio = p.time;
      freqRef = p.freq;
    } else if (freqRef !== null && Math.abs(freqToSemitones(p.freq, freqRef)) > UMBRAL_SEMITONOS_NOTA) {
      notas.push({ start: inicio, end: p.time });
      inicio = p.time;
      freqRef = p.freq;
    }
    ultimoConTono = p.time;
  }
  if (inicio !== null && ultimoConTono !== null) {
    notas.push({ start: inicio, end: Math.min(end, ultimoConTono + HOP_CONTORNO) });
  }

  // Si no se detectó ningún tono en todo el tramo (silencio/respiración), se
  // devuelve el tramo completo tal cual — sintetizarTono ya sabe generar
  // silencio real en ese caso (ver hayTonoReal), no hace falta duplicar esa
  // lógica acá.
  return notas.length > 0 ? notas : [{ start, end }];
}

// Tararea un tramo [start,end) cualquiera —una palabra reconocida por
// Deepgram, o un hueco entre palabras que Deepgram no transcribió pero que
// sí tiene voz cantada (ad-libs, "oohh", vocalizaciones sin letra)— y
// escribe el resultado directo en `pista`. Común a los modos "tono" y
// "tonototal": recorta GAP segundos al final para separarlo del siguiente
// sonido, lo parte en sub-notas según el movimiento de tono real dentro del
// tramo (segmentarNotasEnPalabra), y por cada sub-nota sintetiza su propio
// tono y lo coloca en su posición sobre la línea de tiempo del audio
// ORIGINAL (sumando silencioInicial, que se había recortado antes de
// analizar).
function tararearTramo(
  contorno: FramePitch[], start: number, end: number, sr: number,
  gap: number, pista: Buffer, silencioInicial: number, amplitud = 0.55,
): void {
  const finEfectivo = Math.max(start + 0.02, end - gap);
  const subNotas = segmentarNotasEnPalabra(contorno, start, finEfectivo);

  for (const nota of subNotas) {
    const finNota = Math.max(nota.start + 0.01, nota.end - gap);
    const tono = sintetizarTono(contorno, nota.start, finNota, sr, 180, amplitud);
    const offsetBytes = Math.max(0, Math.round((nota.start + silencioInicial) * sr)) * 2;
    const bytesACopiar = Math.min(tono.length, pista.length - offsetBytes);
    if (bytesACopiar > 0) tono.copy(pista, offsetBytes, 0, bytesACopiar);
  }
}

// Calcula los huecos de tiempo que quedan ENTRE las palabras reconocidas
// (y antes de la primera / después de la última) hasta `finContorno` — ahí
// es donde puede haber voz cantada que Deepgram no transcribió como
// palabra (vocalizaciones, "aahh" sostenidos, coros de fondo).
function calcularHuecos(cues: PalabraOriginal[], finContorno: number): { start: number; end: number }[] {
  const huecos: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const cue of cues) {
    if (cue.start > cursor) huecos.push({ start: cursor, end: cue.start });
    cursor = Math.max(cursor, cue.end);
  }
  if (finContorno > cursor) huecos.push({ start: cursor, end: finContorno });
  return huecos;
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
    const modoRaw = form.get('modo');
    const modo: 'voz' | 'tono' | 'tonototal' | 'guia' =
      modoRaw === 'tono' ? 'tono'
      : modoRaw === 'tonototal' ? 'tonototal'
      : modoRaw === 'guia' ? 'guia'
      : 'voz';
    const silencioInicial = Math.max(0, Number(form.get('silencioInicial')) || 0);

    if (!file) return Response.json({ error: 'Falta el archivo de audio' }, { status: 400 });
    if (modo === 'voz' && !textoLibre?.trim()) {
      return Response.json({ error: 'Falta el texto de reemplazo' }, { status: 400 });
    }

    const audioBuffer = await file.arrayBuffer();
    const contentType = file.type || 'audio/mpeg';

    tmpDir = join(tmpdir(), `cambialetra_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    await mkdir(tmpDir, { recursive: true });

    const extension = (file.name.match(/\.[^.]+$/)?.[0] || '.mp3').toLowerCase();
    const inPath = join(tmpDir, `in${extension}`);
    await writeFile(inPath, Buffer.from(audioBuffer));

    // Si el usuario indica cuántos segundos de silencio hay al inicio, se
    // recorta ANTES de transcribir y de analizar el tono — así no se le paga
    // ni se le espera a Deepgram por una parte que ya sabemos que no tiene
    // nada, y el análisis de tono tampoco pierde tiempo en ella.
    let audioParaAnalizar: ArrayBuffer = audioBuffer;
    let rutaParaDecodificar = inPath;
    if (silencioInicial > 0) {
      const recortadoPath = join(tmpDir, `recortado${extension}`);
      await runFfmpeg(['-y', '-ss', String(silencioInicial), '-i', inPath, '-c', 'copy', recortadoPath]);
      const recortadoBuffer = await readFile(recortadoPath);
      audioParaAnalizar = recortadoBuffer.buffer.slice(
        recortadoBuffer.byteOffset,
        recortadoBuffer.byteOffset + recortadoBuffer.byteLength
      ) as ArrayBuffer;
      rutaParaDecodificar = recortadoPath;
    }

    const transcripcion = await transcribirPalabras(audioParaAnalizar, contentType);
    if ('error' in transcripcion) return Response.json({ error: transcripcion.error }, { status: 422 });
    const { cues } = transcripcion;

    const palabras = modo === 'voz' ? repartirTexto(limpiarAnotaciones(textoLibre!), cues) : [];
    if (modo === 'voz' && palabras.length === 0) {
      return Response.json({ error: 'No se pudo repartir el texto sobre la línea de tiempo del audio' }, { status: 422 });
    }
    if (modo === 'voz' && palabras.length > MAX_PALABRAS) {
      return Response.json({ error: `El texto tiene demasiadas palabras (máximo ${MAX_PALABRAS})` }, { status: 400 });
    }

    // Decodificar el audio (ya recortado, si aplicaba) para extraer su curva de tono
    const origRawPath = join(tmpDir, 'orig.raw');
    await runFfmpeg(['-y', '-i', rutaParaDecodificar, '-f', 's16le', '-ar', String(SR), '-ac', '1', origRawPath]);
    const contorno = pitchContorno(int16BufferToFloat32(await readFile(origRawPath)), SR);

    // Modos "tono", "tonototal" y "guia": sin TTS ni rubberband — por cada
    // palabra del ORIGINAL se genera directamente un tono que sigue la
    // curva de entonación real en ese tramo (partido en sub-notas si el
    // tono se mueve dentro de la palabra, ver tararearTramo). No hay
    // palabras nuevas, es un tarareo del original. "tonototal" y "guia"
    // además tararean los huecos ENTRE palabras que Deepgram no
    // transcribió como palabra pero que sí tienen voz cantada
    // (vocalizaciones, "aahh" sostenidos, coros). "guia" además mezcla
    // ese tarareo con el audio original real (ver mezclarConOriginal) en
    // vez de entregar solo el tono sintético.
    if (modo === 'tono' || modo === 'tonototal' || modo === 'guia') {
      // Las palabras/huecos vienen pegados (el final de uno = el inicio del
      // siguiente), así que el tono saltaba de golpe de una frecuencia a
      // otra en ese punto. Recortando un poco el final de cada tono/nota
      // queda un silencio breve antes del próximo sonido, separándolos en
      // vez de un glissando continuo. Mismo valor para el borde entre
      // tramos y entre sub-notas dentro de un mismo tramo.
      const GAP = 0.02;
      // Las palabras reconocidas suenan más fuerte que los huecos (coros,
      // ad-libs, vocalizaciones sin letra) — así se distingue de oído cuál
      // es la letra principal y cuál es "acompañamiento", en vez de que
      // todo el tarareo completo suene parejo.
      const AMPLITUD_PALABRA = 0.75;
      const AMPLITUD_HUECO = 0.35;
      const finContorno = contorno.length > 0 ? contorno[contorno.length - 1].time + HOP_CONTORNO : 0;
      const duracionTotal = Math.max(Math.max(...cues.map(c => c.end)) + 1, finContorno) + silencioInicial;
      const totalSamples = Math.round(duracionTotal * SR);
      const pista = Buffer.alloc(totalSamples * 2);

      for (const cue of cues) {
        tararearTramo(contorno, cue.start, cue.end, SR, GAP, pista, silencioInicial, AMPLITUD_PALABRA);
      }

      if (modo === 'tonototal' || modo === 'guia') {
        for (const hueco of calcularHuecos(cues, finContorno)) {
          // Huecos muy cortos (menos que un par de gaps) no alcanzan a
          // tararear nada audible — se saltan directamente.
          if (hueco.end - hueco.start < GAP * 2) continue;
          tararearTramo(contorno, hueco.start, hueco.end, SR, GAP, pista, silencioInicial, AMPLITUD_HUECO);
        }
      }

      const finalBuffer = modo === 'guia'
        ? await mezclarConOriginal(pista, SR, inPath, tmpDir)
        : await pistaAMp3(pista, SR, tmpDir);
      const sufijo = modo === 'guia' ? '_guia.mp3' : modo === 'tonototal' ? '_tono_completo.mp3' : '_tono.mp3';
      const name = file.name.replace(/\.[^.]+$/, '') + sufijo;

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

      return { path: wordRawPath, startMs: Math.max(0, Math.round((p.start + silencioInicial) * 1000)) };
    }

    const resultados = await conConcurrencia(palabras, CONCURRENCIA, procesarPalabra);
    const clips = resultados.filter((c): c is { path: string; startMs: number } => c !== null);

    if (clips.length === 0) {
      return Response.json({ error: 'No se pudo sintetizar ninguna palabra' }, { status: 500 });
    }

    // Mezclar todos los clips en la línea de tiempo del audio ORIGINAL
    // (sin recortar), sumando de vuelta el silencio inicial que se saltó.
    const duracionTotal = Math.max(...cues.map(c => c.end)) + 1 + silencioInicial;

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
