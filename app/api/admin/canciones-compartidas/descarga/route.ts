import { NextResponse } from 'next/server';
import { habilitarDescarga } from '@/lib/cancionCompartidaService';
import { soloAdmin } from '@/lib/adminServidor';

// El cliente pagó (o se le devuelve) la descarga de una canción — ver
// habilitarDescarga en lib/cancionCompartidaService.ts.
export async function POST(request: Request) {
  const negado = await soloAdmin(request);
  if (negado) return negado;
  try {
    const { id, habilitar } = await request.json();
    if (!id) return NextResponse.json({ error: 'Falta la canción' }, { status: 400 });
    await habilitarDescarga(id, habilitar !== false);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('canciones-compartidas/descarga:', msg);
    return NextResponse.json({ error: 'Error al cambiar la descarga' }, { status: 500 });
  }
}
