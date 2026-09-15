import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { crearPedido, listarPedidosPorTelefono } from '@/lib/pedidoService';
import { avisarNuevoPedido } from '@/lib/emailService';

// Registro de canciones pedidas por clientes desde el flujo público de
// /crear-parodia — colección separada de "parodias" (que es donde el admin
// guarda sus propias creaciones), para no mezclar los pedidos de clientes
// con el trabajo propio.

export async function GET() {
  const cookieStore = await cookies();
  const telefono = cookieStore.get('tenant_phone')?.value;

  if (!telefono) {
    return NextResponse.json({ error: 'Necesitás registrarte con tu número de teléfono' }, { status: 401 });
  }

  const pedidos = await listarPedidosPorTelefono(telefono);
  return NextResponse.json(pedidos);
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const telefono = cookieStore.get('tenant_phone')?.value;

    if (!telefono) {
      return NextResponse.json({ error: 'Necesitás registrarte con tu número de teléfono' }, { status: 401 });
    }

    const { cancion_base, estilo, descripcionEstilo, direccionGenerador, historia, parodia } = await request.json();

    if (!cancion_base || !historia || !parodia) {
      return NextResponse.json({ error: 'Faltan datos para enviar el pedido' }, { status: 400 });
    }

    const pedido = await crearPedido(telefono, {
      cancion_base, estilo, descripcionEstilo, direccionGenerador, historia, parodia,
    });

    void avisarNuevoPedido(telefono, cancion_base);

    return NextResponse.json(pedido, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';

    if (msg === 'TENANT_NO_ENCONTRADO') {
      return NextResponse.json({ error: 'Necesitás registrarte con tu número de teléfono' }, { status: 401 });
    }
    if (msg === 'SALDO_INSUFICIENTE') {
      return NextResponse.json({ error: 'No te alcanza el saldo. Comprá créditos para pedir esta canción.' }, { status: 402 });
    }

    console.error('crearPedido:', msg);
    return NextResponse.json({ error: 'Error al enviar el pedido' }, { status: 500 });
  }
}
