// Genera una canción completa con Lyria 3.5 (el modelo de música de Google) por la API de Gemini.
// Se cobra por uso aparte de la suscripción de Google AI Plus: ~US$ 0.08 por canción.
// La duración no tiene parámetro: se pide en el texto («full-length song»).
const URL_LYRIA = 'https://generativelanguage.googleapis.com/v1beta/models/lyria-3.5:generateContent';

export async function generarCancionLyria(estilo: string, letra: string): Promise<{ audio: Buffer; mimeType: string }> {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) throw new Error('Falta GEMINI_API_KEY en las variables de entorno');

  const texto = 'Create a full-length song in Spanish (Latin American accent), sung exactly with the following lyrics, '
    + `in this style: ${estilo}\n\nThe lines in [brackets] are section and arrangement cues, not lyrics to sing.\n\nLyrics:\n\n${letra}`;
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
    if (x?.data) return { audio: Buffer.from(x.data, 'base64'), mimeType: x.mimeType ?? x.mime_type ?? 'audio/mpeg' };
  }
  throw new Error(`Gemini no devolvió audio (${data.candidates?.[0]?.finishReason ?? 'sin motivo'})`);
}
