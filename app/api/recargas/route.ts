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

    // El aviso por correo se manda recién cuando el tenant confirma por
    // WhatsApp (ver /api/recargas/[id]/avisar) — no acá, para no generar
    // avisos falsos de gente que solo toca el monto para ver cómo
    // funciona sin llegar a pagar ni avisar nada.
    const recarga = await crearSolicitudRecarga(telefono, monto);

    return NextResponse.json(recarga, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('crearSolicitudRecarga:', msg);
    return NextResponse.json({ error: 'Error al solicitar la recarga' }, { status: 500 });
  }
}
