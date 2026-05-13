import { NextResponse } from 'next/server';

export const maxDuration = 120; // hasta 2 min para canciones largas

interface DGWord {
  word: string;
  punctuated_word?: string;
  start: number;
  end: number;
  confidence: number;
}

// Modelos a intentar en orden de preferencia para canciones
// whisper-large maneja mucho mejor la voz mezclada con música
const MODELS = ['whisper-large', 'nova-2'];

async function tryModel(
  model: string,
  audioBuffer: ArrayBuffer,
  contentType: string,
  apiKey: string
): Promise<{ words: DGWord[]; transcript: string; raw: unknown } | { error: string }> {
  const isWhisper = model.startsWith('whisper');

  // Whisper no soporta smart_format ni language en Deepgram; nova-2 sí
  const params = `model=${model}&punctuate=true&language=es`;

  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method:  'POST',
    headers: {
      Authorization:  `Token ${apiKey}`,
      'Content-Type': contentType,
    },
    body: audioBuffer,
  });

  if (!res.ok) {
    const err = await res.text();
    return { error: `Deepgram ${model} error ${res.status}: ${err}` };
  }

  const data = await res.json();
  const alt = data?.results?.channels?.[0]?.alternatives?.[0];
  const words: DGWord[] = alt?.words ?? [];
  const transcript: string = alt?.transcript ?? '';
  return { words, transcript, raw: data };
}

export async function POST(request: Request) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'DEEPGRAM_API_KEY no configurada' }, { status: 500 });
  }

  let audioBuffer: ArrayBuffer;
  let contentType = 'audio/mpeg';

  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('audio') as File | null;
    if (!file) return NextResponse.json({ error: 'Falta el archivo de audio' }, { status: 400 });
    contentType = file.type || 'audio/mpeg';
    audioBuffer = await file.arrayBuffer();
  } else {
    audioBuffer = await request.arrayBuffer();
    contentType = ct || 'audio/mpeg';
  }

  let lastError = '';
  for (const model of MODELS) {
    const result = await tryModel(model, audioBuffer, contentType, apiKey);

    if ('error' in result) {
      lastError = result.error;
      continue;
    }

    const { words, transcript } = result;

    if (words.length === 0) {
      // Si hay transcripción pero sin timestamps, lo reportamos con más detalle
      lastError = transcript
        ? `Modelo ${model}: se transcribió texto pero sin timestamps por palabra ("${transcript.slice(0, 80)}…"). Prueba con otro formato de audio.`
        : `Modelo ${model}: no se detectaron palabras. Verifica que el audio tenga voz clara.`;
      continue;
    }

    // Convertir a cues: end de cada palabra = start de la siguiente (más fluido para karaoke)
    const cues = words.map((w, i) => ({
      start: w.start,
      end:   words[i + 1]?.start ?? w.end,
      text:  w.punctuated_word || w.word,
    }));

    return NextResponse.json({ cues, model });
  }

  return NextResponse.json({ error: lastError || 'No se pudo transcribir el audio con ningún modelo.' }, { status: 422 });
}
