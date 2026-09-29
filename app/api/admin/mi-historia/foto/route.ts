import { NextResponse } from 'next/server';
import { subirFotoHistoria } from '@/lib/miHistoriaService';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'El archivo debe ser una imagen' }, { status: 400 });

    const id = 'foto' + Date.now() + Math.random().toString(36).slice(2, 8);
    const buffer = Buffer.from(await file.arrayBuffer());
    await subirFotoHistoria(buffer, file.type, id);

    return NextResponse.json({ id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
