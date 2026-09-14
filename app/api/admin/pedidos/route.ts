import { NextResponse } from 'next/server';
import { listarTodosPedidos, marcarPedidoEntregado } from '@/lib/pedidoService';

export async function GET() {
  const pedidos = await listarTodosPedidos();
  return NextResponse.json(pedidos);
}

export async function PATCH(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Falta el id del pedido' }, { status: 400 });

    await marcarPedidoEntregado(id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('marcarPedidoEntregado:', msg);
    return NextResponse.json({ error: 'Error al actualizar el pedido' }, { status: 500 });
  }
}
