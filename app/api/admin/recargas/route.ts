import { NextResponse } from 'next/server';
import { listarTodasRecargas, resolverRecarga } from '@/lib/recargaService';
import { soloAdmin } from '@/lib/adminServidor';

export async function GET(request: Request) {
  const negado = await soloAdmin(request);
  if (negado) return negado;
  const recargas = await listarTodasRecargas();
  return NextResponse.json(recargas);
}

export async function PATCH(request: Request) {
  const negado = await soloAdmin(request);
  if (negado) return negado;
  try {
    const { id, aprobar } = await request.json();
    if (!id || typeof aprobar !== 'boolean') {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    await resolverRecarga(id, aprobar);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';

    if (msg === 'RECARGA_YA_RESUELTA') {
      return NextResponse.json({ error: 'Esta recarga ya fue resuelta' }, { status: 409 });
    }

    console.error('resolverRecarga:', msg);
    return NextResponse.json({ error: 'Error al resolver la recarga' }, { status: 500 });
  }
}
