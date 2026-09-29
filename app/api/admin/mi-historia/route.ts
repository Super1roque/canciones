import { NextResponse } from 'next/server';
import { obtenerHistoria, guardarHistoria, type HistoriaData } from '@/lib/miHistoriaService';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const data = await obtenerHistoria();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = (await request.json()) as HistoriaData;
    await guardarHistoria(data);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
