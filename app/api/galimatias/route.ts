import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { transcribirPalabras, sintetizarVoz } from '@/lib/deepgramService';
import { generarGalimatias } from '@/lib/claudeService';
import { pitchPromedio, midiToFreq } from '@/lib/pitchTracker';
import { int16BufferToFloat32 } from '@/lib/audioPcm';
import { contentDisposition } from '@/lib/contentDisposition';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const FFMPEG = ffmpegInstaller.path;
const TTS_SAMPLE_RATE = 24000;

// Sílabas simples y uniformes (consonante+vocal abierta) para el modo
// "silaba": mucho más robustas que palabras inventadas al estirarlas/
// cambiarles el tono con rubberband — el clásico "la la la" para tararear.
const SILABAS_SIMPLES = ['la', 'na', 'da', 'ma', 'ra', 'ta'];

interface NoteEvent {
  startTimeSeconds: number;
  durationSeconds: number;
  pitchMidi: number;
  amplitude: number;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, args, { maxBuffer: 200 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) reject(new Error(stderr?.slice(-500) || err.message));
      else resolve();
    });
  });
}

// Encuentra la nota con mayor solape temporal con [start, end]; si ninguna
// se solapa, cae a la nota más cercana por punto medio.
function mejorNota(notes: NoteEvent[], start: number, end: number): NoteEvent | null {
  if (notes.length === 0) return null;

  let mejor: NoteEvent | null = null;
  let mejorSolape = 0;
  for (const n of notes) {
    const nEnd = n.startTimeSeconds + n.durationSeconds;
    const solape = Math.max(0, Math.min(end, nEnd) - Math.max(start, n.startTimeSeconds));
    if (solape > mejorSolape) { mejorSolape = solape; mejor = n; }
  }
  if (mejor) return mejor;

  const mid = (start + end) / 2;
  return notes.reduce((cercana, n) => {
    const nMid = n.startTimeSeconds + n.durationSeconds / 2;
    const cMid = cercana.startTimeSeconds + cercana.durationSeconds / 2;
    return Math.abs(nMid - mid) < Math.abs(cMid - mid) ? n : cercana;
  });
}

export async function POST(request: Request) {
  let tmpDir: string | null = null;
  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const notesRaw = form.get('notes') as string | null;
    const duracionRaw = form.get('duration') as string | null;
    const modoRaw = form.get('modo') as string;
    const modo = modoRaw === 'beep' ? 'beep' : modoRaw === 'silaba' ? 'silaba' : 'voz';

    if (!file) return Response.json({ error: 'Falta el archivo de audio' }, { status: 400 });
    if (!notesRaw) return Response.json({ error: 'Faltan las notas de melodía detectadas' }, { status: 400 });

    let notes: NoteEvent[];
    try {
      notes = JSON.parse(notesRaw);
    } catch {
      return Response.json({ error: 'Las notas enviadas no son JSON válido' }, { status: 400 });
    }

    const audioBuffer = await file.arrayBuffer();
    const contentType = file.type || 'audio/mpeg';

    // 1. Transcribir la letra original con timestamps por palabra
    const transcripcion = await transcribirPalabras(audioBuffer, contentType);
    if ('error' in transcripcion) {
      return Response.json({ error: transcripcion.error }, { status: 422 });
    }
    const { cues } = transcripcion;

    // 2. Generar una palabra sin sentido por cada palabra original (mismo orden).
    //    En modo "silaba"/"beep" no hace falta invocar a Claude.
    const galimatias = modo === 'voz' ? await generarGalimatias(cues.map(c => c.text)) : [];

    tmpDir = join(tmpdir(), `galimatias_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    await mkdir(tmpDir, { recursive: true });

    // 3. Por cada palabra: sintetizar voz, medir su tono y ajustarla con
    //    rubberband para que caiga exactamente en el tiempo y tono de la nota original
    const clips: { path: string; startMs: number }[] = [];

    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i];
      const palabra = modo === 'silaba' ? SILABAS_SIMPLES[i % SILABAS_SIMPLES.length] : (galimatias[i] ?? cue.text);
      const duracionObjetivo = Math.max(0.08, cue.end - cue.start);

      const nota = mejorNota(notes, cue.start, cue.end);
      const freqObjetivo = nota ? midiToFreq(nota.pitchMidi) : null;

      const outPath = join(tmpDir, `word_${i}.wav`);

      if (modo === 'beep') {
        // Modo de diagnóstico/alternativa: un tono puro en vez de voz, para
        // aislar si el problema está en la mezcla o en la síntesis de voz.
        const freq = freqObjetivo ?? 440;
        const fadeOutStart = Math.max(0, duracionObjetivo - 0.03);
        await runFfmpeg([
          '-f', 'lavfi', '-i', `sine=frequency=${freq.toFixed(3)}:duration=${duracionObjetivo.toFixed(3)}:sample_rate=${TTS_SAMPLE_RATE}`,
          '-af', `afade=t=in:d=0.02,afade=t=out:st=${fadeOutStart.toFixed(3)}:d=0.03`,
          '-y', outPath,
        ]);
      } else {
        const ttsBuffer = await sintetizarVoz(palabra, { sampleRate: TTS_SAMPLE_RATE });
        const pcmBuf = Buffer.from(ttsBuffer);
        const pcm = int16BufferToFloat32(pcmBuf);
        const duracionActual = pcm.length / TTS_SAMPLE_RATE;
        if (duracionActual <= 0) continue;

        let pitchFactor = 1;
        if (freqObjetivo) {
          const freqMedida = pitchPromedio(pcm, TTS_SAMPLE_RATE);
          if (freqMedida) {
            pitchFactor = Math.max(0.4, Math.min(2.5, freqObjetivo / freqMedida));
          }
        }
        const tempoFactor = Math.max(0.3, Math.min(4, duracionActual / duracionObjetivo));

        const rawPath = join(tmpDir, `word_${i}.raw`);
        await writeFile(rawPath, pcmBuf);

        await runFfmpeg([
          '-f', 's16le', '-ar', String(TTS_SAMPLE_RATE), '-ac', '1', '-i', rawPath,
          '-af', `rubberband=tempo=${tempoFactor.toFixed(6)}:pitch=${pitchFactor.toFixed(6)}`,
          '-ar', String(TTS_SAMPLE_RATE), '-y', outPath,
        ]);
      }

      clips.push({ path: outPath, startMs: Math.max(0, Math.round(cue.start * 1000)) });
    }

    if (clips.length === 0) {
      return Response.json({ error: 'No se pudo sintetizar ninguna palabra' }, { status: 500 });
    }

    // 4. Mezclar todos los clips en la línea de tiempo original
    const duracionTotal = duracionRaw ? parseFloat(duracionRaw) : Math.max(...cues.map(c => c.end)) + 1;

    const inputArgs: string[] = [];
    clips.forEach(c => inputArgs.push('-i', c.path));

    const delays = clips.map((c, i) => `[${i}:a]adelay=${c.startMs}|${c.startMs}[a${i}]`).join(';');
    const mixInputs = clips.map((_, i) => `[a${i}]`).join('');
    // Este build de ffmpeg no soporta apad=whole_dur (opción de versiones más
    // nuevas); usamos whole_len en muestras a la sample rate de los clips TTS.
    const muestrasObjetivo = Math.round(duracionTotal * TTS_SAMPLE_RATE);
    // Este build de ffmpeg no tiene amix=normalize=0 (opción de versiones más
    // nuevas): amix SIEMPRE divide el volumen entre el número de inputs para
    // evitar clipping, aunque casi todo cada input sea silencio. Con muchas
    // palabras eso deja el resultado casi inaudible — lo compensamos
    // multiplicando el volumen de vuelta y limitando por si hay solapes.
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
    const name = file.name.replace(/\.[^.]+$/, '') + '_galimatias.mp3';

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
