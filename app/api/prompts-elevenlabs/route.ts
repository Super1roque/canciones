import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TAGS_DISPONIBLES = `- Pausas: [pause] (pausa media, ~0.6s), [short pause] (~0.4-0.5s), [long pause] (~0.7-0.8s)
- Emociones: [serious], [calm], [excited], [nervous], [frustrated], [sorrowful], [curious], [angry], [happy]
- Reacciones/sonidos: [sighs], [laughs], [laughs harder], [chuckles], [gasps], [gulps], [crying], [snorts]
- Estilo de entrega: [whispers], [shouts], [flatly], [deadpan], [playfully], [quietly], [cautiously], [ironic], [sarcastic], [mischievously]
- Cognitivo/pacing: [hesitates], [stammers], [resigned tone]
- Conversación (multi-voz): [jumping in], [interrupting], [overlapping]`;

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
          content: `Actúa como un experto en producción de audio para ElevenLabs, específicamente en el modelo Eleven v3.

CONTEXTO IMPORTANTE: ElevenLabs v3 NO usa SSML (nada de <speak>, <prosody>, <break>). Usa su propio sistema de "audio tags" entre corchetes, insertados directo en el texto.

Tu tarea: tomar el texto en español que te doy abajo y devolverlo con audio tags de ElevenLabs v3 insertados, para narración en tono: ${tonoFinal}.

TAGS DISPONIBLES (usa solo estos, no inventes otros):
${TAGS_DISPONIBLES}

REGLAS DE ESTILO (esto es lo más importante, respétalo estrictamente):
1. Usa los tags con moderación. NO le pongas un tag a cada frase — eso satura y confunde al modelo de voz. La mayoría del texto debe ir sin tags, dejando que la pausa y el contenido hagan el trabajo.
2. Abre con UN tag de tono general que marque el registro de todo el texto, y no lo repitas después salvo que el tono cambie de verdad.
3. Los tags de emoción puntual ([ironic], [sarcastic], [resigned tone], etc.) van SOLO en los 1-3 momentos del texto donde el contenido realmente lo pide — no en cada párrafo.
4. Marca pausas naturales del discurso: al final de una idea completa [pause], entre bloques/temas [long pause], dentro de una enumeración o antes de un remate corto [short pause].
5. No cambies ni una palabra del texto original — solo insertas tags, nunca reescribes el contenido.
6. Devuelve ÚNICAMENTE el texto con los tags insertados, listo para copiar y pegar en ElevenLabs — sin explicaciones antes o después, sin comillas envolventes, sin markdown.

TEXTO A CONVERTIR:
${texto}`,
        },
      ],
    });

    const resultado = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    return NextResponse.json({ resultado });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error desconocido' }, { status: 500 });
  }
}
