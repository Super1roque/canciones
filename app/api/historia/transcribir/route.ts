import { NextResponse } from 'next/server';
import { transcribirHabla } from '@/lib/deepgramService';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Dictado por voz para las respuestas de Mi Historia — sin clave porque no
// guarda nada, solo convierte el audio grabado en el navegador a texto.
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get('audio') as File | null;
    if (!file) return NextResponse.json({ error: 'Falta el audio' }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const resultado = await transcribirHabla(buffer, file.type || 'audio/webm');

    if ('error' in resultado) return NextResponse.json({ error: resultado.error }, { status: 422 });
    return NextResponse.json(resultado);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
