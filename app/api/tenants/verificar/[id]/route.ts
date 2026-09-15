import { NextResponse } from 'next/server';
import { obtenerVerificacion } from '@/lib/verificacionService';
import { obtenerOCrearTenant } from '@/lib/tenantService';

const COOKIE_NAME = 'tenant_phone';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // ~180 días

// El landing hace polling acá mientras espera que el admin apruebe. Recién
// cuando ve "aprobada" crea/confirma el tenant y setea la cookie de
// sesión — antes de eso, el teléfono declarado no vale nada por sí solo.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const verificacion = await obtenerVerificacion(id);

  if (!verificacion) {
    return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
  }

  if (verificacion.estado !== 'aprobada') {
    return NextResponse.json({ estado: verificacion.estado });
  }

  await obtenerOCrearTenant(verificacion.telefono);

  const res = NextResponse.json({ estado: 'aprobada' });
  res.cookies.set(COOKIE_NAME, verificacion.telefono, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
  return res;
}
