import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { crearSolicitudRecarga, listarRecargasPorTelefono, MONTOS_VALIDOS } from '@/lib/recargaService';

export async function GET() {
  const cookieStore = await cookies();
  const telefono = cookieStore.get('tenant_phone')?.value;

  if (!telefono) {
    return NextResponse.json({ error: 'Necesitás registrarte con tu número de teléfono' }, { status: 401 });
  }

  const recargas = await listarRecargasPorTelefono(telefono);
  return NextResponse.json(recargas);
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const telefono = cookieStore.get('tenant_phone')?.value;

    if (!telefono) {
      return NextResponse.json({ error: 'Necesitás registrarte con tu número de teléfono' }, { status: 401 });
    }

    const { monto } = await request.json();

    if (!MONTOS_VALIDOS.includes(monto)) {
      return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });
    }

    // Ya no se manda ningún aviso por correo acá — el "voy a depositar"
    // del tenant no es un depósito confirmado (hubo casos de gente que
    // avisaba sin haber pagado). El admin acredita el saldo a mano desde
    // /admin/tenants recién después de confirmar el comprobante que le
    // llega por WhatsApp; esta solicitud queda solo como registro de que
    // alguien dijo que iba a pagar.
    const recarga = await crearSolicitudRecarga(telefono, monto);

    return NextResponse.json(recarga, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('crearSolicitudRecarga:', msg);
    return NextResponse.json({ error: 'Error al solicitar la recarga' }, { status: 500 });
  }
}
