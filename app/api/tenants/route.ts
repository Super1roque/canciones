import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebaseService';
import { normalizarTelefono, telefonoValido, obtenerOCrearTenant } from '@/lib/tenantService';

const COOKIE_NAME = 'tenant_phone';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // ~180 días

// Registro (o reconocimiento, si ya existe) de un tenant — ahora exige un
// idToken de Firebase Phone Auth en vez de confiar en un teléfono tipeado a
// mano: el teléfono se toma del claim verificado del token, nunca de lo que
// mande el cliente, así nadie puede registrarse con un número ajeno.
export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Falta el token de verificación' }, { status: 400 });
    }

    let phoneNumber: string | undefined;
    try {
      const decoded = await getAuth().verifyIdToken(idToken);
      phoneNumber = decoded.phone_number;
    } catch {
      return NextResponse.json({ error: 'Token de verificación inválido o vencido' }, { status: 401 });
    }

    const telefono = normalizarTelefono(phoneNumber || '');

    if (!telefonoValido(telefono)) {
      return NextResponse.json({ error: 'El token no trae un teléfono verificado' }, { status: 400 });
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
