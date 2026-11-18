import Anthropic from '@anthropic-ai/sdk';

// Genera una canción completa con Lyria 3.5 (el modelo de música de Google) por la API de Gemini.
// Se cobra por uso aparte de la suscripción de Google AI Plus: ~US$ 0.08 por canción.
// La duración no tiene parámetro: se pide en el texto («full-length song»).
const URL_LYRIA = 'https://generativelanguage.googleapis.com/v1beta/models/lyria-3.5:generateContent';
// RECITATION: Lyria descartó lo que generó por parecerse a una canción existente. Cada intento sale distinto.
const REINTENTOS_RECITATION = 2;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Armando (18 nov 2026): el estilo de los pedidos es el de Suno (una línea); Lyria entiende mejor una descripción
// detallada por secciones (instrumentación, voz, estructura). Solo se reescribe el estilo: la letra va intacta.
const SISTEMA_ESTILO = `You write music-generation prompts for Google Lyria. You receive a short style description written for Suno and the song's lyrics (for context only).
Rewrite the style as a detailed English prompt with exactly these three sections:
[Style & Instrumentation] genre, time signature, BPM, instruments and their roles, mix and atmosphere.
[Vocal Performance] voice type, delivery, emotion.
[Arrangement & Timeline Structure] a bullet per section of the given lyrics, in order (intro, verses, choruses, bridge, outro), with approximate timestamps for a full-length song of about 2:30 to 3:30, describing the instrumentation of each part.
Keep the genre, tempo and instruments of the original style. It must be an original composition: do not name artists, bands or existing songs, and do not ask to imitate any recording.
Reply with the prompt only, no explanations.`;

export async function optimizarEstilo(estilo: string, letra: string): Promise<string> {
  try {
    const r = await client.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      system: SISTEMA_ESTILO,
      messages: [{ role: 'user', content: `Style:\n${estilo}\n\nLyrics:\n${letra}` }],
    });
    const texto = r.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim();
    return texto || estilo;
  } catch (e) {
    // Si Claude falla, se genera con el estilo tal cual: la optimización es una ayuda, no un requisito.
    console.error('optimizarEstilo:', e instanceof Error ? e.message : e);
    return estilo;
  }
}

async function llamarLyria(clave: string, texto: string): Promise<{ audio?: Buffer; mimeType?: string; motivo: string }> {
  const res = await fetch(URL_LYRIA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
    body: JSON.stringify({ contents: [{ parts: [{ text: texto }] }], generationConfig: { responseModalities: ['AUDIO', 'TEXT'] } }),
  });
  if (!res.ok) throw new Error(`Gemini respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = await res.json();
  // Lyria bloquea algunos estilos (p. ej. con «satirical» o «mocking») y entonces no trae candidatos.
  const bloqueo = data.promptFeedback?.blockReason;
  if (bloqueo) throw new Error(`Gemini bloqueó el pedido (${bloqueo}). Probá suavizar el estilo o la letra.`);
  for (const parte of data.candidates?.[0]?.content?.parts ?? []) {
    const x = parte.inlineData ?? parte.inline_data;
    if (x?.data) return { audio: Buffer.from(x.data, 'base64'), mimeType: x.mimeType ?? x.mime_type ?? 'audio/mpeg', motivo: 'OK' };
  }
  return { motivo: data.candidates?.[0]?.finishReason ?? 'sin motivo' };
}

export async function generarCancionLyria(estilo: string, letra: string): Promise<{ audio: Buffer; mimeType: string }> {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) throw new Error('Falta GEMINI_API_KEY en las variables de entorno');

  const estiloLyria = await optimizarEstilo(estilo, letra);
  const texto = 'Create a full-length song in Spanish (Latin American accent), sung exactly with the following lyrics, '
    + `in this style:\n\n${estiloLyria}\n\nThe lines in [brackets] are section and arrangement cues, not lyrics to sing.\n\nLyrics:\n\n${letra}`;

  let motivo = '';
  for (let intento = 0; intento <= REINTENTOS_RECITATION; intento++) {
    const r = await llamarLyria(clave, texto);
    if (r.audio) return { audio: r.audio, mimeType: r.mimeType! };
    motivo = r.motivo;
    if (motivo !== 'RECITATION') break;
  }
  if (motivo === 'RECITATION') {
    throw new Error(`Gemini no la hizo en ${REINTENTOS_RECITATION + 1} intentos porque le salía parecida a una canción existente. Probá otra vez más tarde o hacela en Suno.`);
  }
  throw new Error(`Gemini no devolvió audio (${motivo})`);
}
