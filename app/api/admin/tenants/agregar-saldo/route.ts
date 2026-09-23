import { NextResponse } from 'next/server';
import { agregarSaldo } from '@/lib/tenantService';

// Función exclusiva del admin — nada de esto pasa por aprobación de una
// solicitud del tenant. El admin la usa recién después de confirmar el
// depósito por su cuenta (la foto del comprobante que le llega por
// WhatsApp), no en base a lo que el tenant reporte dentro de la app.
export async function POST(request: Request) {
  try {
    const { telefono, monto } = await request.json();
    const montoNum = Number(monto);

    if (!telefono) return NextResponse.json({ error: 'Falta el teléfono' }, { status: 400 });
    if (!montoNum || montoNum <= 0) return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });

    await agregarSaldo(telefono, montoNum);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('agregar-saldo:', msg);
    return NextResponse.json({ error: 'Error al agregar saldo' }, { status: 500 });
  }
}
