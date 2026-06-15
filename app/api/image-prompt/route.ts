import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { lyrics, fullLyrics, sectionLabel, sectionType, songStyle } = await req.json() as {
      lyrics: string;
      fullLyrics: string;
      sectionLabel: string;
      sectionType: string;
      songStyle?: string;
    };

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Eres un director de arte experto en crear prompts para generadores de imágenes (Midjourney, DALL-E, Stable Diffusion).

LETRA COMPLETA DE LA CANCIÓN (contexto global — protagonistas, mood, paleta):
${fullLyrics}

---
SECCIÓN ESPECÍFICA: "${sectionLabel}" (${sectionType})
${lyrics}
---
${songStyle ? `\nESTILO VISUAL DEFINIDO PARA TODA LA CANCIÓN:\n${songStyle}\n` : ''}
INSTRUCCIONES:
1. De la letra COMPLETA extrae los protagonistas principales y el mood general de la canción.
2. Crea un prompt en inglés para la sección específica, visualmente consistente con toda la canción.
3. ${songStyle ? 'Usa EXACTAMENTE el estilo visual definido arriba — incorpóralo al final del prompt.' : 'Infiere el estilo visual más adecuado para el mood de la canción.'}
4. El prompt debe incluir: protagonistas de esa escena, ambiente, iluminación y paleta de colores.
5. Máximo 2 oraciones, detallado y cinematográfico.
6. Si el prompt incluye algún texto visible en la imagen (letreros, titulares, palabras), especifica que ese texto debe estar en español.
7. Responde ÚNICAMENTE con el prompt en inglés listo para copiar, sin comillas ni explicaciones.`,
      }],
    });

    const prompt = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    return NextResponse.json({ prompt });

  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error desconocido' }, { status: 500 });
  }
}
