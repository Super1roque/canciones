import { NextResponse } from 'next/server';
import { soloAdmin, COOKIE_ADMIN, firmaAdmin } from '@/lib/adminServidor';

export const runtime = 'nodejs';

// El panel la llama al abrirse: deja este navegador marcado como del admin por un año (ver esNavegadorAdmin).
export async function POST(request: Request) {
  const negado = await soloAdmin(request);
  if (negado) return negado;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_ADMIN, firmaAdmin(), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 365 * 24 * 3600 });
  return res;
}
