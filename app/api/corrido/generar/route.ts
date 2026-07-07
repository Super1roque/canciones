import { NextResponse } from 'next/server';
import { generarCorrido } from '@/lib/claudeService';

export async function POST(request: Request) {
  try {
    const { nombre, region, estilo } = await request.json();

    if (!nombre?.trim() || !region?.trim()) {
      return NextResponse.json({ error: 'Nombre y región son requeridos' }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'API key de Anthropic no configurada' }, { status: 500 });
    }

    const corrido = await generarCorrido({
      nombre: nombre.trim(),
      region: region.trim(),
      estilo: estilo?.trim() || undefined,
    });

    return NextResponse.json({ corrido, nombre, region, estilo: estilo || null });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error generando corrido:', msg);
    return NextResponse.json({ error: 'Error al generar el corrido: ' + msg }, { status: 500 });
  }
}
