import { NextResponse } from 'next/server';
import { guardarCancionCompartida } from '@/lib/guardarCancionCompartida';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Colección separada de `audio_shares` (esa es el teaser de pago de
// /escuchar — 2 reproducciones y se borra). Acá el objetivo es viralizar,
// no cobrar: se puede escuchar indefinidamente.
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const titulo = (formData.get('titulo') as string | null)?.trim();
    const pedidoId = (formData.get('pedidoId') as string | null)?.trim();

    if (!file) return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    if (!file.type.startsWith('audio/')) return NextResponse.json({ error: 'El archivo debe ser audio' }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'El archivo supera el límite de 20 MB' }, { status: 400 });
    if (!titulo) return NextResponse.json({ error: 'Falta el título de la canción' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const id = await guardarCancionCompartida(buffer, file.type || 'audio/mpeg', titulo, pedidoId || undefined);
    return NextResponse.json({ id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('canciones-compartidas/upload:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
