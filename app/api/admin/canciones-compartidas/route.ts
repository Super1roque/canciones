import { NextResponse } from 'next/server';
import { listarCancionesCompartidas } from '@/lib/cancionCompartidaService';

export async function GET() {
  const canciones = await listarCancionesCompartidas();
  return NextResponse.json(canciones);
}
