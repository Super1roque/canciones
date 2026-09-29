import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const { pregunta, respuesta } = await request.json();
    if (!pregunta || !respuesta || !respuesta.trim()) {
      return NextResponse.json({ error: 'Falta la pregunta o la respuesta' }, { status: 400 });
    }

    const prompt = 'Sos un asistente que ayuda a alguien a recordar más detalles de su propia vida para escribir su biografía.\n' +
      'Pregunta original: "' + pregunta + '"\n' +
      'Su respuesta: "' + respuesta + '"\n\n' +
      'Generá entre 4 y 6 preguntas de seguimiento breves, cálidas, en segunda persona ("vos"/"tú"), que ayuden a profundizar EXCLUSIVAMENTE en lo que la persona ya escribió. No inventes hechos, personas ni fechas que no haya mencionado. No repitas la pregunta original.\n' +
      'Respondé SOLO con un array JSON de strings, sin texto antes ni después. Ejemplo: ["¿Qué edad tenías en ese momento?", "¿Quién más estaba ahí?"]';

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });
    const texto = (response.content[0] as { type: 'text'; text: string }).text;
    const match = texto.match(/\[[\s\S]*\]/);
    const preguntas = JSON.parse(match ? match[0] : texto);
    if (!Array.isArray(preguntas)) throw new Error('Respuesta no es un array');

    return NextResponse.json({ preguntas: preguntas.slice(0, 6).map(String) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
