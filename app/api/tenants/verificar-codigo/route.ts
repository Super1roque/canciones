import { NextResponse } from 'next/server';
import { normalizarTelefono, conCodigoPais, telefonoValido } from '@/lib/tenantService';
import { verificarCodigoAcceso } from '@/lib/verificacionService';

const COOKIE_NAME = 'tenant_phone';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // ~180 días

// Entrada alternativa para alguien que ya fue aprobado antes pero perdió la
// sesión (cerró la pestaña, cambió de celular, etc.) — el código se lo pasó
// el admin a mano por WhatsApp al aprobar, así que confirmar el código acá
// equivale a haber pasado ya por esa verificación real.
export async function POST(request: Request) {
  try {
    const { telefono: rawTelefono, codigo } = await request.json();
    const telefono = normalizarTelefono(conCodigoPais(rawTelefono || ''));

    if (!telefonoValido(telefono)) {
      return NextResponse.json({ error: 'Ese número no parece válido' }, { status: 400 });
    }
    if (!codigo || typeof codigo !== 'string') {
      return NextResponse.json({ error: 'Ingresá el código que te enviamos' }, { status: 400 });
    }

    const valido = await verificarCodigoAcceso(telefono, codigo.trim());
    if (!valido) {
      return NextResponse.json({ error: 'Código inválido o vencido' }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
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
    console.error('verificarCodigoAcceso:', msg);
    return NextResponse.json({ error: 'Error al verificar el código' }, { status: 500 });
  }
}
