export interface DGWord {
  word: string;
  punctuated_word?: string;
  start: number;
  end: number;
  confidence: number;
}

export interface Cue {
  start: number;
  end: number;
  text: string;
}

// Modelos a intentar en orden de preferencia para canciones
// whisper-large maneja mucho mejor la voz mezclada con música
const MODELS = ['whisper-large', 'nova-2'];

// Palabras a ignorar (créditos automáticos de Amara.org u otros)
const IGNORE = new Set([
  'subtítulos', 'subtitulos', 'realizados', 'por', 'la', 'comunidad', 'de',
  'amara.org', 'amara', 'subtitled', 'by', 'community',
]);

// Reintenta ante fallos de red transitorios (frecuentes cuando hay muchas
// llamadas en paralelo, como en cambialetra) antes de rendirse.
async function fetchConReintentos(url: string, init: RequestInit, intentos = 3): Promise<Response> {
  let ultimoError: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      ultimoError = err;
      if (i < intentos - 1) await new Promise(r => setTimeout(r, 300 * (i + 1)));
    }
  }
  const causa = ultimoError instanceof Error && ultimoError.cause ? ` (${String(ultimoError.cause)})` : '';
  throw new Error(`No se pudo conectar a Deepgram tras ${intentos} intentos${causa}`);
}

async function tryModel(
  model: string,
  audioBuffer: ArrayBuffer,
  contentType: string,
  apiKey: string
): Promise<{ words: DGWord[]; transcript: string } | { error: string }> {
  const isWhisper = model.startsWith('whisper');

  // Whisper no soporta smart_format ni language en Deepgram; nova-2 sí
  const params = `model=${model}&punctuate=true&language=es`;

  const res = await fetchConReintentos(`https://api.deepgram.com/v1/listen?${params}`, {
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
  return { words, transcript };
}

/**
 * Transcribe un audio (canción o a capella) con timestamps por palabra,
 * probando varios modelos de Deepgram en orden hasta obtener resultado.
 */
export async function transcribirPalabras(
  audioBuffer: ArrayBuffer,
  contentType: string
): Promise<{ cues: Cue[]; model: string } | { error: string }> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return { error: 'DEEPGRAM_API_KEY no configurada' };

  let lastError = '';
  for (const model of MODELS) {
    const result = await tryModel(model, audioBuffer, contentType, apiKey);

    if ('error' in result) {
      lastError = result.error;
      continue;
    }

    const { words, transcript } = result;

    if (words.length === 0) {
      lastError = transcript
        ? `Modelo ${model}: se transcribió texto pero sin timestamps por palabra ("${transcript.slice(0, 80)}…"). Prueba con otro formato de audio.`
        : `Modelo ${model}: no se detectaron palabras. Verifica que el audio tenga voz clara.`;
      continue;
    }

    const filtered = words.filter(w => {
      const clean = w.word.toLowerCase().replace(/[^a-záéíóúüñ]/gi, '');
      return clean.length > 0 && !IGNORE.has(clean);
    });

    if (filtered.length === 0) {
      lastError = `Modelo ${model}: solo se detectaron créditos de subtítulos, no se encontró letra cantada.`;
      continue;
    }

    // Convertir a cues: end de cada palabra = start de la siguiente (más fluido para karaoke)
    const cues: Cue[] = filtered.map((w, i) => ({
      start: w.start,
      end:   filtered[i + 1]?.start ?? w.end,
      text:  w.punctuated_word || w.word,
    }));

    return { cues, model };
  }

  return { error: lastError || 'No se pudo transcribir el audio con ningún modelo.' };
}

const AURA_VOICES = new Set([
  'sirio', 'estrella', 'javier', 'luciano', 'olivia', 'valerio',
  'nestor', 'carina', 'alvaro', 'diana', 'agustina', 'silvia',
  'celeste', 'gloria', 'aquila', 'selena', 'antonia',
]);

/**
 * Sintetiza texto en español con Deepgram Aura-2 TTS.
 * Devuelve el audio en linear16 (PCM 16-bit) mono a la sampleRate pedida.
 */
export async function sintetizarVoz(
  texto: string,
  opts: { voz?: string; sampleRate?: number } = {}
): Promise<ArrayBuffer> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY no configurada');

  const voz = opts.voz && AURA_VOICES.has(opts.voz) ? opts.voz : 'javier';
  const sampleRate = opts.sampleRate ?? 24000;
  const model = `aura-2-${voz}-es`;

  const res = await fetchConReintentos(
    `https://api.deepgram.com/v1/speak?model=${model}&encoding=linear16&sample_rate=${sampleRate}&container=none`,
    {
      method:  'POST',
      headers: {
        Authorization:  `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: texto }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Deepgram Aura TTS error ${res.status}: ${err}`);
  }

  return res.arrayBuffer();
}
