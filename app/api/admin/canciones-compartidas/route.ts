import { NextResponse } from 'next/server';
import { listarCancionesCompartidas } from '@/lib/cancionCompartidaService';
import { soloAdmin } from '@/lib/adminServidor';

export async function GET(request: Request) {
  const negado = await soloAdmin(request);
  if (negado) return negado;
  const canciones = await listarCancionesCompartidas();
  return NextResponse.json(canciones);
}
