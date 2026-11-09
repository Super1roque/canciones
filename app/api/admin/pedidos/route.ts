import { NextResponse } from 'next/server';
import { esAdminPeticion } from '@/lib/adminServidor';
import { listarTodosPedidos, marcarPedidoEntregado } from '@/lib/pedidoService';
import { avisarCancionLista } from '@/lib/pushService';

export async function GET(request: Request) {
  if (!(await esAdminPeticion(request))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const pedidos = await listarTodosPedidos();
  return NextResponse.json(pedidos);
}

export async function PATCH(request: Request) {
  if (!(await esAdminPeticion(request))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Falta el id del pedido' }, { status: 400 });

    const pedido = await marcarPedidoEntregado(id);
    void avisarCancionLista(pedido.telefono, pedido.cancion_base);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('marcarPedidoEntregado:', msg);
    return NextResponse.json({ error: 'Error al actualizar el pedido' }, { status: 500 });
  }
}
