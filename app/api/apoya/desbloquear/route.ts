import { cookies } from 'next/headers';
import { COOKIE_MIEMBRO, tokenMiembro } from '@/lib/miembrosApoya';

export const runtime = 'nodejs';

// Igual que el desbloqueo de los audiolibros, pero para la membresía: el miembro escribe el correo con el que
// paga en Hotmart y lo que es para miembros (las radionovelas) queda abierto en este navegador. La cookie guarda
// un token, no el correo, y se revisa en cada pedido: si el miembro se da de baja, deja de abrir.
export async function POST(request: Request) {
  const cuerpo = await request.json().catch(() => null);
  const email = typeof cuerpo?.email === 'string' ? cuerpo.email : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return Response.json({ ok: false, error: 'Escribe un correo válido.' }, { status: 400 });
  }
  try {
    const token = await tokenMiembro(email);
    if (!token) return Response.json({ ok: false });
    (await cookies()).set(COOKIE_MIEMBRO, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
    return Response.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('apoya/desbloquear:', msg);
    return Response.json({ ok: false, error: 'No se pudo comprobar. Intenta de nuevo.' }, { status: 500 });
  }
}
