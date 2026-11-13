import { NextResponse } from 'next/server';
import { prorrogarVigencia } from '@/lib/cancionCompartidaService';
import { soloAdmin } from '@/lib/adminServidor';

// Botón «Darle 36 h más» de /admin/pedidos — ver prorrogarVigencia en lib/cancionCompartidaService.ts.
export async function POST(request: Request) {
  const negado = await soloAdmin(request);
  if (negado) return negado;
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Falta la canción' }, { status: 400 });
    await prorrogarVigencia(id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('canciones-compartidas/prorrogar:', msg);
    return NextResponse.json({ error: 'Error al dar más tiempo' }, { status: 500 });
  }
}
