import { NextResponse } from 'next/server';

// httpOnly no se puede borrar desde JS del cliente — hace falta una ruta
// que la limpie del lado del servidor.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('tenant_phone', '', { maxAge: 0, path: '/' });
  return res;
}
