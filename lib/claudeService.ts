import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres un experto en poesía, música y composición de letras en español, especializado en crear parodias ingeniosas de canciones.

Tu misión es generar parodias que respeten ESTRICTAMENTE las siguientes reglas:

0. REGLA ABSOLUTA — SIN COPIAS
   - NINGÚN verso de la parodia puede ser idéntico ni casi idéntico al original
   - Si un verso de la parodia coincide palabra por palabra (o cambia solo 1-2 palabras) con el original, es un FALLO GRAVE
   - Cada verso DEBE ser completamente reescrito con palabras y contenido nuevos
   - Esto tiene PRIORIDAD sobre cualquier otra regla, incluyendo la métrica

1. MÉTRICA EXACTA
   - Analiza el número exacto de sílabas de cada verso original
   - Cada verso de la parodia debe tener EXACTAMENTE el mismo número de sílabas
   - Aplica correctamente las reglas de sinalefa, hiato y elisión
   - No alcanza con que el TOTAL de sílabas coincida: la distribución por palabra debe ser parecida a la del original. Si el verso original usa varias palabras cortas, no las reemplaces por una sola palabra larga (ni al revés) — eso rompe la forma del verso aunque el total cuadre

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

// El usuario a veces solo escribe un nombre en vez de una historia — en ese
// caso la parodia debe girar en torno a esa persona en vez de fallar por
// falta de temática.
function esSoloNombre(historia: string): boolean {
  return historia.trim().split(/\s+/).filter(Boolean).length <= 4;
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

const ESTILOS_CORRIDO: Record<string, string> = {
  tradicional: 'Corrido Tradicional Norteño: narrativo y respetuoso, con expresiones clásicas como "les voy a contar", "señores", "en el año de...", lenguaje formal y épico.',
  tumbado:     'Corrido Tumbado: flow relajado y urbano, mezcla slang norteño moderno con referencias a la calle, cadencia suave, frases como "ya saben cómo es", "el señor no falla".',
  alterado:    'Corrido Alterado: lenguaje crudo y directo, adrenalina, referencias al narco y el poder, frases contundentes, sin rodeos.',
  sierra:      'Corrido de la Sierra: campestre y humilde, con referencias a la tierra, el rancho, los animales, la familia y el paisaje norteño.',
}

export async function generarCorrido(params: {
  nombre: string
  region: string
  estilo?: string
}): Promise<string> {
  const { nombre, region, estilo } = params
  const estiloDesc = estilo && ESTILOS_CORRIDO[estilo]
    ? `\nESTILO: ${ESTILOS_CORRIDO[estilo]}`
    : '\nESTILO: Elige el estilo que mejor se adapte al personaje y región.'

  const systemPrompt = `Eres un compositor experto en música regional mexicana, especializado en corridos. Generas corridos completos, bien estructurados y auténticos, con vocabulario propio del género norteño.

Un corrido bien hecho tiene:
- Verso introductorio (presenta al protagonista)
- Versos narrativos (cuentan su historia)
- Coro (memorable y repetible)
- Verso de cierre
- Rima consistente (preferiblemente ABCB o ABAB)
- Métrica de 8 sílabas por línea (octosílabo) como base

IMPORTANTE: Responde ÚNICAMENTE con la letra del corrido, usando etiquetas como [VERSO 1], [CORO], [VERSO 2], [CIERRE]. Sin explicaciones ni comentarios adicionales.`

  const userPrompt = `Compón un corrido personalizado con los siguientes datos:

PROTAGONISTA: ${nombre}
REGIÓN DE ORIGEN: ${region}${estiloDesc}

El corrido debe mencionar naturalmente el nombre y la región del protagonista. Hazlo sonar auténtico, como si fuera un corrido real grabado en Norteño.`

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  return (response.content[0] as { type: 'text'; text: string }).text
}

export async function generarParodia(
  cancion: Cancion,
  historia: string,
  alcance: 'completa' | 'coro' = 'completa'
): Promise<string> {
  const modoPrueba = esModoPrueba(historia);
  const soloCoro = alcance === 'coro';

  const instruccionAlcance = soloCoro
    ? `\n\n⚠ ALCANCE SOLICITADO: SOLO EL CORO\nNo generes la canción completa. Genera ÚNICAMENTE la parodia de la sección de coro (etiquetada como [Chorus], [Coro] o variante equivalente) que aparece en la LETRA ORIGINAL de arriba. Ignora el resto de las secciones (versos, intro, puente, outro, etc.). Respeta el número exacto de versos, la métrica y la rima de esa sección.\n\nFORMATO DE SALIDA OBLIGATORIO: Tu respuesta debe comenzar EXACTAMENTE con estas dos líneas (tal cual, sin traducir ni modificar), seguidas de la letra del coro:\n[Chorus]\n[Using uploaded melody]`
    : '';

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

Genera ${soloCoro ? 'solo el coro de la parodia (no la canción completa)' : 'la parodia completa'} usando EXCLUSIVAMENTE las palabras de la lista y respetando la estructura de la canción original.${instruccionAlcance}`;

  } else {
    const soloNombre = esSoloNombre(historia);

    const bloqueHistoria = soloNombre
      ? `NOMBRE DE LA PERSONA HOMENAJEADA:\n${historia}\n\nEl usuario no dio una historia, solo el nombre de esta persona. Genera la parodia teniendo a "${historia.trim()}" como protagonista y tema central: la letra debe girar en torno a esa persona (un homenaje, celebración o relato creativo sobre ella), coherente con el estilo de la canción.`
      : `HISTORIA/TEMÁTICA PARA LA PARODIA:\n${historia}`;

    userPrompt = `Genera una parodia de la siguiente canción:

━━━━━━━━━━━━━━━━━━━━━━
CANCIÓN ORIGINAL: "${cancion.nombre}"
ESTILO MUSICAL: ${cancion.estilo}${cancion.descripcionEstilo ? `\nDESCRIPCIÓN DEL ESTILO: ${cancion.descripcionEstilo}` : ''}
━━━━━━━━━━━━━━━━━━━━━━

LETRA ORIGINAL:
${cancion.letra}

━━━━━━━━━━━━━━━━━━━━━━
${bloqueHistoria}
━━━━━━━━━━━━━━━━━━━━━━

Antes de generar la parodia, corrige internamente cualquier error gramatical u ortográfico de la historia/temática. Usa la versión corregida como base, pero no menciones ni muestres las correcciones.

Genera ${soloCoro ? 'solo el coro de la parodia (no la canción completa)' : 'la parodia completa'} respetando ESTRICTAMENTE la métrica, rima, acentos rítmicos y estructura de la canción original.

VERIFICACIÓN OBLIGATORIA ANTES DE RESPONDER: Revisa verso por verso que ninguno sea igual ni casi igual al original. Si encuentras alguno, reescríbelo.${cancion.direccionGenerador ? `\n\nDIRECCIÓN ADICIONAL PARA LA GENERACIÓN:\n${cancion.direccionGenerador}` : ''}${instruccionAlcance}`;
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

const SYSTEM_PROMPT_GALIMATIAS = `Eres un experto en fonética del español, especializado en inventar palabras sin significado (galimatías) que suenan naturales al cantarse.

Reglas estrictas para cada palabra que inventes:
1. Debe tener EXACTAMENTE el mismo número de sílabas que la palabra original.
2. La sílaba tónica debe estar en la misma posición que en la palabra original.
3. NO debe ser una palabra real del español ni parecerse demasiado a la original.
4. Usa preferentemente vocales abiertas (a, e, o) y consonantes fáciles de cantar (m, n, l, r, d, b), evitando grupos consonánticos difíciles.
5. No debe tener ningún significado.

IMPORTANTE: Responde ÚNICAMENTE con un array JSON de strings, en el mismo orden y con la misma cantidad de elementos que la lista de entrada. No pienses en voz alta, no muestres tu razonamiento ni recuentos de sílabas, no incluyas explicaciones, markdown ni ningún texto antes o después del array. Cuenta las sílabas y el acento mentalmente antes de responder, y da directamente el resultado final.`;

/**
 * Genera, para cada palabra de una letra transcrita, una palabra inventada
 * sin significado que conserva el número de sílabas y el acento tónico —
 * pensada para "doblar" una canción a capella con galimatías cantables.
 */
export async function generarGalimatias(palabras: string[]): Promise<string[]> {
  if (palabras.length === 0) return [];

  const listaNumerada = palabras.map((p, i) => `${i + 1}. ${p}`).join('\n');
  const userPrompt = `Inventa una palabra sin sentido por cada palabra de esta lista, respetando sílabas y acento tónico:\n\n${listaNumerada}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT_GALIMATIAS,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const texto = (response.content[0] as { type: 'text'; text: string }).text;

  // Toma el último array plano de la respuesta: si Claude piensa en voz alta
  // antes de responder, el resultado final es el último bloque, no el primero.
  const matches = texto.match(/\[[^[\]]*\]/g);
  if (!matches || matches.length === 0) throw new Error('Claude no devolvió un array JSON válido');

  const resultado = JSON.parse(matches[matches.length - 1]);
  if (!Array.isArray(resultado) || resultado.length !== palabras.length) {
    throw new Error(`Se esperaban ${palabras.length} palabras y se recibieron ${Array.isArray(resultado) ? resultado.length : 0}`);
  }

  return resultado.map(String);
}
