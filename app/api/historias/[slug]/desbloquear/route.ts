import { cookies } from 'next/headers';
import { tokenPorEmail } from '@/lib/accesoAudiolibros';
import { cookieHistoria, getHistoria } from '@/lib/historias';

export const runtime = 'nodejs';

// Igual que /api/morazan/desbloquear, para cualquier libro de /historias que esté a la venta:
// el comprador escribe el correo con el que pagó y el libro queda abierto en este navegador.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const historia = getHistoria((await params).slug);
  if (!historia) return Response.json({ ok: false }, { status: 404 });
  const cuerpo = await request.json().catch(() => null);
  const email = typeof cuerpo?.email === 'string' ? cuerpo.email : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return Response.json({ ok: false, error: 'Escribe un correo válido.' }, { status: 400 });
  }
  try {
    const token = await tokenPorEmail(historia.slug, email);
    if (!token) return Response.json({ ok: false });
    (await cookies()).set(cookieHistoria(historia.slug), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365 * 5,
    });
    return Response.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('historias/desbloquear:', historia.slug, msg);
    return Response.json({ ok: false, error: 'No se pudo comprobar. Intenta de nuevo.' }, { status: 500 });
  }
}
