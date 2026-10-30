import { cookies } from 'next/headers';
import { COOKIE_MORAZAN, tokenPorEmail } from '@/lib/accesoAudiolibros';

export const runtime = 'nodejs';

// El comprador escribe el correo con el que pagó en Hotmart y queda desbloqueado en este
// navegador. Respuestas: { ok: true } o { ok: false } (todavía no llega el aviso de Hotmart,
// o ese correo no compró). La página reintenta unos segundos justo después del pago.
export async function POST(request: Request) {
  const cuerpo = await request.json().catch(() => null);
  const email = typeof cuerpo?.email === 'string' ? cuerpo.email : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return Response.json({ ok: false, error: 'Escribe un correo válido.' }, { status: 400 });
  }
  try {
    const token = await tokenPorEmail('morazan', email);
    if (!token) return Response.json({ ok: false });
    (await cookies()).set(COOKIE_MORAZAN, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365 * 5,
    });
    return Response.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('morazan/desbloquear:', msg);
    return Response.json({ ok: false, error: 'No se pudo comprobar. Intenta de nuevo.' }, { status: 500 });
  }
}
