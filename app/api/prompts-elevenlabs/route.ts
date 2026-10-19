import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TAGS_DISPONIBLES = `- Pausas: [pause] (~0.6s), [short pause] (~0.4-0.5s), [long pause] (~0.7-0.8s)
- Emociones: [serious], [calm], [excited], [nervous], [frustrated], [sorrowful], [curious], [angry], [happy], [confident], [thoughtful]
- Reacciones/sonidos: [sighs], [sighs], [laughs], [laughs harder], [chuckles], [gasps], [gasp], [gulps], [crying], [snorts], [clears throat]
- Estilo de entrega: [whispers], [shouts], [flatly], [deadpan], [playfully], [quietly], [softly], [cautiously], [ironic], [sarcastic], [mischievously], [warm], [smiling], [speaking slowly]
- Cognitivo/pacing: [hesitates], [stammers], [resigned tone]
- Conversación (multi-voz): [jumping in], [interrupting], [overlapping]
- Se pueden COMBINAR dos descriptores en un mismo corchete cuando el momento lo amerita, ej. [warm, smiling], [confident, slow] — con moderación, no en cada línea.`;

export async function POST(req: NextRequest) {
  try {
    const { texto, tono } = (await req.json()) as { texto?: string; tono?: string };

    if (!texto || !texto.trim()) {
      return NextResponse.json({ error: 'Falta el texto a convertir' }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 });
    }

    const tonoFinal = tono?.trim() || 'serio y narrativo';

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `Actúa como un guionista experto en producción de audio para ElevenLabs, específicamente en el modelo Eleven v3, que usa "audio tags" entre corchetes insertados directo en el texto (NO SSML — nada de <speak>, <prosody>, <break>).

Tu tarea: a partir del texto en español que te doy abajo, armar un GUION completo listo para ElevenLabs, en tono: ${tonoFinal}.

TAGS DISPONIBLES (usa solo estos o combinaciones de dos como [warm, smiling] — no inventes tags fuera de esta lista):
${TAGS_DISPONIBLES}

REGLAS DE ESTILO para el guion (muy importante, respétalas estrictamente):
1. Tags con moderación: NO le pongas un tag a cada frase — eso satura y confunde al modelo de voz. La mayoría del texto va sin tags.
2. Abre con un tag de tono/entrega que marque el registro general.
3. Usa contraste cuando el contenido lo pida: momentos bajos/íntimos ([whispers], [softly]) contra picos de energía ([excited]), si el texto tiene ese arco.
4. Pausas estratégicas: [pause]/[short pause]/[long pause] en los cortes naturales de idea, y puntos suspensivos (...) para que la voz respire.
5. Los tags de emoción puntual van SOLO en los momentos donde el contenido realmente lo pide — no decorativos.
6. No cambies ni una palabra del texto original — solo insertas tags y, como máximo, saltos de línea entre bloques. Nunca reescribas el contenido.
7. Si el texto es largo, puedes dividirlo en bloques separados por una línea en blanco, cada uno con su propio arranque de tag si el tono cambia entre bloques.

Además del guion en sí, dame:
- Un título corto y descriptivo para esta pieza (estilo "El Giro Inesperado").
- Una sugerencia de voz (ej. "Narrador en español, tono maduro, dinámico y expresivo").
- Un uso sugerido (ej. "Voz en off para video, notas de prensa, TikTok/Reels o minidocumental") — infiérelo del contenido y el tono.
- 2 a 4 "claves del guion": frases cortas explicando las decisiones de tags que tomaste y por qué (ej. "Estructura de contraste: pasa de ... a ... para mantener al oyente enganchado").

Responde ÚNICAMENTE con un objeto JSON válido (sin markdown, sin \`\`\`json, sin texto antes o después), con esta forma exacta:
{"titulo": "...", "vozSugerida": "...", "uso": "...", "guion": "...", "claves": ["...", "..."]}

El campo "guion" debe contener SOLO el texto narrado con sus tags (lo que se pega directo en ElevenLabs) — nunca el título, la voz sugerida, el uso ni las claves.

TEXTO A CONVERTIR:
${texto}`,
        },
      ],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const limpio = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

    let datos: { titulo?: string; vozSugerida?: string; uso?: string; guion?: string; claves?: string[] };
    try {
      datos = JSON.parse(limpio);
    } catch {
      // si por algo no vino como JSON válido, al menos devolvemos el texto crudo como guion
      datos = { guion: raw };
    }

    return NextResponse.json({
      titulo: datos.titulo || '',
      vozSugerida: datos.vozSugerida || '',
      uso: datos.uso || '',
      guion: datos.guion || '',
      claves: Array.isArray(datos.claves) ? datos.claves : [],
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error desconocido' }, { status: 500 });
  }
}
