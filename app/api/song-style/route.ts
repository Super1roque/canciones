import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { fullLyrics } = await req.json() as { fullLyrics: string };

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Eres un director de arte. Analiza esta letra de canción y sugiere el estilo visual más adecuado para generar imágenes que acompañen la canción.

LETRA:
${fullLyrics}

Responde con un objeto JSON con dos campos:
- "style": una descripción concisa del estilo visual en inglés, lista para incluir en un prompt de imagen (ej: "cinematic photography, dramatic lighting, warm golden tones, 35mm film grain")
- "reason": una frase corta en español explicando por qué ese estilo encaja con la canción

Responde SOLO con el JSON, sin markdown.`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'Respuesta inválida' }, { status: 500 });

    const result = JSON.parse(jsonMatch[0]) as { style: string; reason: string };
    return NextResponse.json(result);

  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error desconocido' }, { status: 500 });
  }
}
