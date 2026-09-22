import { NextResponse } from 'next/server';
import { desvincularCancionCompartida } from '@/lib/pedidoService';
import { eliminarCancionCompartida } from '@/lib/cancionCompartidaService';

// Deshace una subida equivocada: quita el link del pedido y borra el
// audio/doc de canciones_compartidas por completo (no tiene sentido
// dejarlo huérfano si el archivo era el incorrecto).
export async function POST(request: Request) {
  try {
    const { pedidoId } = await request.json();
    if (!pedidoId) return NextResponse.json({ error: 'Falta el id del pedido' }, { status: 400 });

    const { cancionCompartidaId } = await desvincularCancionCompartida(pedidoId);
    if (cancionCompartidaId) await eliminarCancionCompartida(cancionCompartidaId);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('desvincular-cancion:', msg);
    return NextResponse.json({ error: 'Error al desvincular la canción' }, { status: 500 });
  }
}
