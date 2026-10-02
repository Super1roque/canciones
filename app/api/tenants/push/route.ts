import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validarSesion } from '@/lib/tenantService';
import { guardarSuscripcionPushTenant, eliminarSuscripcionPushTenant } from '@/lib/pushService';

// Gate igual al resto de rutas del tenant: requiere sesión válida (no
// alcanza con el teléfono crudo) — así nadie puede registrar una
// suscripción push a nombre de un número que no es el suyo.
async function telefonoDeSesion(): Promise<string | null> {
  const cookieStore = await cookies();
  const telefono = cookieStore.get('tenant_phone')?.value;
  if (!telefono) return null;
  const tenant = await validarSesion(telefono, cookieStore.get('tenant_session')?.value);
  return tenant ? telefono : null;
}

export async function POST(request: Request) {
  try {
    const telefono = await telefonoDeSesion();
    if (!telefono) {
      return NextResponse.json({ error: 'Necesitás una sesión activa' }, { status: 401 });
    }

    const subscription = await request.json();
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 });
    }

    await guardarSuscripcionPushTenant(telefono, subscription);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('tenants/push POST:', msg);
    return NextResponse.json({ error: 'Error al guardar la suscripción' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const telefono = await telefonoDeSesion();
    if (!telefono) {
      return NextResponse.json({ error: 'Necesitás una sesión activa' }, { status: 401 });
    }

    const { endpoint } = await request.json();
    if (!endpoint) return NextResponse.json({ error: 'Falta el endpoint' }, { status: 400 });
    await eliminarSuscripcionPushTenant(endpoint);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('tenants/push DELETE:', msg);
    return NextResponse.json({ error: 'Error al borrar la suscripción' }, { status: 500 });
  }
}
