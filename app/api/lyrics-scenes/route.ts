import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Dado el arreglo de ORACIONES de un relato narrado (una por línea, en
// orden — cada una termina en punto, no son versos de una canción), le
// pide a Claude UNA consulta de búsqueda en inglés POR ORACIÓN (para
// Pexels) — se manda todo junto en una sola llamada, con el contexto
// completo del relato, para que las consultas tengan continuidad de mood
// entre sí en vez de generarse cada una a ciegas, pero cada una debe
// representar específicamente lo que dice SU propia oración — así el
// plano que aparece en pantalla corresponde a lo que se está narrando en
// ese momento exacto.

interface ContextoRelato {
  protagonista: string;
  ambientacion: string;
  tono: string;
  elementosClave: string[];
  entornoHispano: boolean;
}

const CONTEXTO_NEUTRO: ContextoRelato = {
  protagonista: 'desconocido — no asumas género ni edad salvo que una oración puntual lo diga',
  ambientacion: 'desconocida — no asumas lugar ni época salvo que una oración puntual lo diga',
  tono: 'neutro',
  elementosClave: [],
  entornoHispano: false,
};

// Paso 1: antes de pedir ninguna consulta de búsqueda, se lee el relato
// COMPLETO de punta a punta para fijar quién es el protagonista (género,
// edad aproximada, rol), dónde y cuándo ocurre la historia, y el tono
// general — así las consultas de cada oración suelta no "adivinan" cada
// una por su cuenta (lo que antes hacía que, por ejemplo, una oración
// mostrara una mujer y la siguiente un hombre sin que el relato cambiara
// de personaje). Si la respuesta no se puede parsear, se sigue con un
// contexto neutro en vez de romper todo el pipeline por este paso extra.
function construirPromptAnalisis(relatoCompleto: string): string {
  return `Leé el siguiente relato completo (es la base de un video narrado con metraje de stock) y analizá su contexto visual antes de que se busquen clips para ilustrarlo.

RELATO COMPLETO:
"""
${relatoCompleto}
"""

Respondé ÚNICAMENTE con un objeto JSON (sin markdown, sin explicación) con este formato exacto:
{"protagonista": "...", "ambientacion": "...", "tono": "...", "elementosClave": ["...", "..."], "entornoHispano": true/false}

- "protagonista": quién es el protagonista o los protagonistas principales — género, edad aproximada y rol si el relato lo deja claro (ej. "hombre adulto, agricultor"); si el relato no da pistas de género o edad, escribí "desconocido, no asumir género".
- "ambientacion": lugar y época de la historia (ej. "zona rural, posiblemente décadas pasadas", "ciudad moderna, de noche", "interior de una casa, época indefinida").
- "tono": el tono narrativo general en una o dos palabras (ej. melancólico, de suspenso, nostálgico, alegre, dramático).
- "elementosClave": de 2 a 4 elementos visuales recurrentes o importantes del relato, en español, cortos.
- "entornoHispano": true si el relato transcurre explícitamente en un país, ciudad o barrio de América Latina, o usa términos como "colonia"/"barrio" en ese sentido, o de cualquier otra forma deja claro que el entorno es latino/hispano; false si no hay ninguna indicación de eso en el texto.`;
}

async function analizarRelato(client: Anthropic, lines: string[]): Promise<ContextoRelato> {
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: construirPromptAnalisis(lines.join(' ')) }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return CONTEXTO_NEUTRO;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ContextoRelato>;
    return {
      protagonista: parsed.protagonista?.trim() || CONTEXTO_NEUTRO.protagonista,
      ambientacion: parsed.ambientacion?.trim() || CONTEXTO_NEUTRO.ambientacion,
      tono: parsed.tono?.trim() || CONTEXTO_NEUTRO.tono,
      elementosClave: Array.isArray(parsed.elementosClave) ? parsed.elementosClave.filter(e => typeof e === 'string') : [],
      entornoHispano: parsed.entornoHispano === true,
    };
  } catch {
    return CONTEXTO_NEUTRO;
  }
}

function construirPrompt(lines: string[], contexto: ContextoRelato, instruccionTema: string, recordatorio: string): string {
  const oracionesNumeradas = lines.map((l, i) => `[${i}] ${l}`).join('\n');
  return `Eres un director de fotografía que arma un video narrado (como un audiolibro ilustrado) usando metraje de stock (Pexels), a partir de un relato novelesco.

CONTEXTO DEL RELATO (analizado de antemano leyendo la historia completa — mantené consistencia con esto en TODAS las consultas, no lo contradigas):
- Protagonista: ${contexto.protagonista}
- Ambientación: ${contexto.ambientacion}
- Tono: ${contexto.tono}
${contexto.elementosClave.length ? `- Elementos clave recurrentes: ${contexto.elementosClave.join(', ')}` : ''}
${contexto.entornoHispano ? '- Entorno: el relato transcurre en un país, ciudad o barrio latino/hispano — cuando una consulta muestre personas o un vecindario, agregá términos como "latino"/"hispanic" (ej. "hispanic neighborhood street", "latino family house") para que el metraje encaje con ese entorno real, en vez de devolver algo genéricamente estadounidense o europeo.\n' : ''}
RELATO COMPLETO, una oración por línea (cada una termina en punto), numeradas:
${oracionesNumeradas}
${instruccionTema}
Para CADA oración numerada, generá UNA consulta de búsqueda de video en INGLÉS (2 a 5 palabras) que Pexels pueda usar para encontrar un clip de stock que ilustre ESA oración específicamente — no el tema general del relato, sino lo que esa oración puntual narra o evoca. Cada oración va a mostrar su PROPIO clip, así que la consulta debe ser específica a su contenido, no una genérica repetida para todo el relato.

REGLAS:
1. Usá sustantivos y escenas CONCRETAS y FILMABLES (ej: "woman walking beach sunset", "city street rain night", "hands holding coffee cup") — evitá conceptos abstractos que no se puedan buscar como video ("amor", "tristeza", "libertad" solos no funcionan).
2. Si una oración es emocional, reflexiva o abstracta, traducila a una escena visual concreta que evoque ese sentimiento (ej. "sintió que el corazón se le quebraba" → "person alone window rain").
3. Mantené coherencia visual y de mood entre oraciones consecutivas, con el tono general del relato, y SOBRE TODO con el CONTEXTO DEL RELATO de arriba — no saltes de tema, de personaje ni de ambientación sin razón entre una oración y la siguiente.
4. Cuando una oración se refiera al protagonista sin dar detalles nuevos (ej. "él caminó", "la persona miró", "siguió adelante"), la consulta debe seguir representando AL MISMO protagonista descrito en el contexto — mismo género, edad y rol — nunca cambiar a otra persona distinta sin que el relato lo diga explícitamente.
5. Si dos o más oraciones son idénticas o casi idénticas, igual generá UNA entrada por CADA UNA — nunca fusiones ni te saltes una oración por estar repetida. El array final DEBE tener exactamente ${lines.length} elementos, ni uno más ni uno menos.
6. Nunca menciones marcas, texto en pantalla, ni celebridades.
${recordatorio}
Respondé ÚNICAMENTE con un array JSON de strings, en el mismo orden y misma cantidad que las oraciones (${lines.length} elementos), sin markdown ni explicación:
["consulta en inglés para oración 0", "consulta en inglés para oración 1", ...]`;
}

// Pide las consultas a Claude y devuelve lo que haya podido parsear como
// array de strings — null solo si la respuesta ni siquiera trae un array
// JSON reconocible. El chequeo de que la CANTIDAD calce con `lines` se hace
// afuera, para poder reintentar o normalizar sin perder lo que sí vino.
async function pedirQueries(
  client: Anthropic, lines: string[], contexto: ContextoRelato, instruccionTema: string, recordatorio: string,
): Promise<string[] | null> {
  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: construirPrompt(lines, contexto, instruccionTema, recordatorio) }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return null;

  try {
    const queries = JSON.parse(jsonMatch[0]) as unknown;
    if (!Array.isArray(queries) || queries.length === 0) return null;
    return queries.map(q => (typeof q === 'string' && q.trim()) || 'cinematic abstract background');
  } catch {
    return null;
  }
}

// Ajusta el array de consultas a la cantidad exacta de oraciones: recorta
// si sobran, y si faltan completa repitiendo la última consulta conocida
// (o una genérica si no hay ninguna) — así el video siempre puede
// generarse aunque la IA se haya equivocado en el conteo.
function normalizarCantidad(queries: string[], cantidad: number): string[] {
  if (queries.length === cantidad) return queries;
  if (queries.length > cantidad) return queries.slice(0, cantidad);
  const relleno = queries[queries.length - 1] ?? 'cinematic abstract background';
  return [...queries, ...Array(cantidad - queries.length).fill(relleno)];
}

export async function POST(req: NextRequest) {
  try {
    const { lines, theme } = await req.json() as { lines: string[]; theme?: string };

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: 'Se requieren las oraciones del relato' }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const temaLimpio = theme?.trim();
    const instruccionTema = temaLimpio
      ? `\nAMBIENTACIÓN PEDIDA POR EL USUARIO: "${temaLimpio}" — TODAS las consultas deben encajar visualmente con esta ambientación (ej. si es "rancheros": caballos, campo, vaqueros, botas, sombreros, vida rural; si es "de ciudad": skyline, calles, tráfico, luces nocturnas urbanas). Adaptá cada oración a esta ambientación PERO siempre reflejando su propio contenido — no te salgas de ella salvo que sea imposible de encajar con una oración puntual.\n`
      : '';

    // Paso 1: leer el relato completo de punta a punta para fijar
    // protagonista/ambientación/tono ANTES de pedir ninguna consulta —
    // así cada oración no "adivina" por su cuenta y todas quedan
    // consistentes entre sí (ver analizarRelato).
    const contexto = await analizarRelato(client, lines);

    // Paso 2: primer intento normal; si Claude devuelve una cantidad de
    // consultas distinta a la de oraciones (pasa con relatos largos),
    // reintentamos UNA vez remarcando el conteo exacto antes de rendirnos.
    let queries = await pedirQueries(client, lines, contexto, instruccionTema, '');
    if (!queries || queries.length !== lines.length) {
      const reintento = await pedirQueries(
        client, lines, contexto, instruccionTema,
        `\nIMPORTANTE: en un intento anterior no devolviste exactamente ${lines.length} elementos. Contá las oraciones numeradas del [0] al [${lines.length - 1}] y asegurate de que tu array tenga EXACTAMENTE esa cantidad de elementos, una por cada oración, sin fusionar ni saltear ninguna.\n`,
      );
      if (reintento) queries = reintento;
    }

    if (!queries) {
      return NextResponse.json({ error: 'La IA no devolvió consultas válidas para el relato. Probá generar de nuevo.' }, { status: 500 });
    }

    // Si después del reintento la cantidad sigue sin calzar, normalizamos en
    // vez de tirar todo el video por la borda por un desajuste de conteo.
    return NextResponse.json({ queries: normalizarCantidad(queries, lines.length) });

  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error desconocido' }, { status: 500 });
  }
}
