import { NextResponse } from 'next/server';
import { normalizarTelefono, telefonoValido, obtenerOCrearTenant } from '@/lib/tenantService';

const COOKIE_NAME = 'tenant_phone';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // ~180 días

// Registro (o reconocimiento, si ya existe) de un tenant por teléfono — sin
// verificación por SMS, se confía en el número que ingresan.
export async function POST(request: Request) {
  try {
    const { telefono: crudo } = await request.json();
    const telefono = normalizarTelefono(crudo || '');

    if (!telefonoValido(telefono)) {
      return NextResponse.json({ error: 'Ingresá un número de teléfono válido' }, { status: 400 });
    }

    const tenant = await obtenerOCrearTenant(telefono);

    const res = NextResponse.json(tenant, { status: 200 });
    res.cookies.set(COOKIE_NAME, telefono, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });
    return res;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Firestore registrarTenant:', msg);
    return NextResponse.json({ error: 'Error al registrar el número' }, { status: 500 });
  }
}
