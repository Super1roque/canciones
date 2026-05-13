import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres un experto en poesía, música y composición de letras en español, especializado en crear parodias ingeniosas de canciones.

Tu misión es generar parodias que respeten ESTRICTAMENTE las siguientes reglas:

1. MÉTRICA EXACTA
   - Analiza el número exacto de sílabas de cada verso original
   - Cada verso de la parodia debe tener EXACTAMENTE el mismo número de sílabas
   - Aplica correctamente las reglas de sinalefa, hiato y elisión

2. ESQUEMA DE RIMA
   - Identifica el patrón de rima del original (ABAB, AABB, ABBA, etc.)
   - Conserva el mismo patrón en la parodia
   - Mantén el tipo de rima (consonante o asonante)

3. ACENTOS RÍTMICOS
   - Las sílabas tónicas deben coincidir posicionalmente con las del original
   - Esto garantiza que la letra nueva encaje perfectamente con la melodía

4. ESTRUCTURA MUSICAL
   - Preserva y etiqueta claramente todas las secciones: [VERSO 1], [VERSO 2], [PRE-CORO], [CORO], [PUENTE], [CORO FINAL], etc.
   - No omitas ni añadas secciones

5. CONTENIDO
   - La parodia debe narrar creativamente la historia/temática proporcionada
   - El tono debe ser ingenioso, humorístico o creativo según la historia
   - Mantén la fluidez y naturalidad del lenguaje

IMPORTANTE: Responde ÚNICAMENTE con la letra de la parodia. No incluyas análisis, comparativas, explicaciones, comentarios ni ningún texto adicional antes o después de la letra.`;

type Cancion = { nombre: string; estilo: string; descripcionEstilo?: string; direccionGenerador?: string; letra: string };

// Detecta si la historia es una parodia de prueba
function esModoPrueba(historia: string): boolean {
  return historia.trim().toLowerCase().startsWith('esta es una prueba');
}

// Extrae las palabras únicas del texto (sin puntuación, en minúsculas)
function extraerPalabras(texto: string): string[] {
  const palabras = texto
    .toLowerCase()
    .replace(/[^a-záéíóúüñ\s]/gi, ' ')
    .split(/\s+/)
    .filter(p => p.length > 0);
  return [...new Set(palabras)].sort();
}

export async function generarParodia(cancion: Cancion, historia: string): Promise<string> {
  const modoPrueba = esModoPrueba(historia);

  let userPrompt: string;

  if (modoPrueba) {
    const palabrasPermitidas = extraerPalabras(historia);
    const listaPalabras = palabrasPermitidas.join(', ');

    userPrompt = `Genera una parodia de la siguiente canción:

━━━━━━━━━━━━━━━━━━━━━━
CANCIÓN ORIGINAL: "${cancion.nombre}"
ESTILO MUSICAL: ${cancion.estilo}${cancion.descripcionEstilo ? `\nDESCRIPCIÓN DEL ESTILO: ${cancion.descripcionEstilo}` : ''}
━━━━━━━━━━━━━━━━━━━━━━

LETRA ORIGINAL:
${cancion.letra}

━━━━━━━━━━━━━━━━━━━━━━
⚠ MODO PRUEBA — RESTRICCIÓN ESTRICTA DE VOCABULARIO
━━━━━━━━━━━━━━━━━━━━━━

CAMPO DE TEMÁTICA ORIGINAL:
${historia}

PALABRAS PERMITIDAS (ÚNICAS QUE PUEDES USAR):
${listaPalabras}

REGLA ABSOLUTA E INNEGOCIABLE:
Cada palabra que escribas en la parodia DEBE aparecer exactamente en la lista de palabras permitidas de arriba. No puedes usar ninguna otra palabra, sin excepción. Ni artículos, ni preposiciones, ni conjunciones que no estén en esa lista. Si necesitas una palabra y no está en la lista, elige otra de las que sí están. Puedes usar la misma palabra varias veces y puedes usar las palabras en cualquier orden. No uses conjugaciones distintas a las que ya aparecen en la lista a menos que las puedas formar con palabras de la lista. Esta restricción tiene PRIORIDAD ABSOLUTA sobre cualquier otra consideración, incluyendo la métrica y la rima — aunque siempre intenta respetarlas en la medida de lo posible dentro de las palabras permitidas.

Genera la parodia completa usando EXCLUSIVAMENTE las palabras de la lista y respetando la estructura de la canción original.`;

  } else {
    userPrompt = `Genera una parodia de la siguiente canción:

━━━━━━━━━━━━━━━━━━━━━━
CANCIÓN ORIGINAL: "${cancion.nombre}"
ESTILO MUSICAL: ${cancion.estilo}${cancion.descripcionEstilo ? `\nDESCRIPCIÓN DEL ESTILO: ${cancion.descripcionEstilo}` : ''}
━━━━━━━━━━━━━━━━━━━━━━

LETRA ORIGINAL:
${cancion.letra}

━━━━━━━━━━━━━━━━━━━━━━
HISTORIA/TEMÁTICA PARA LA PARODIA:
${historia}
━━━━━━━━━━━━━━━━━━━━━━

Antes de generar la parodia, corrige internamente cualquier error gramatical u ortográfico de la historia/temática. Usa la versión corregida como base, pero no menciones ni muestres las correcciones.

Genera la parodia completa respetando ESTRICTAMENTE la métrica, rima, acentos rítmicos y estructura de la canción original.${cancion.direccionGenerador ? `\n\nDIRECCIÓN ADICIONAL PARA LA GENERACIÓN:\n${cancion.direccionGenerador}` : ''}`;
  }


  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cache_control: { type: 'ephemeral' },
      } as any,
    ],
    messages: [{ role: 'user', content: userPrompt }],
  });

  return (response.content[0] as { type: 'text'; text: string }).text;
}
