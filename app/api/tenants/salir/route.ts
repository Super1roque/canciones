import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { liberarSesion } from '@/lib/tenantService';

// Deja que alguien cambie de número en su propio dispositivo sin depender
// de que el admin la libere a mano — limpia tanto el lado del servidor
// (sesionId) como las cookies de este navegador.
export async function POST() {
  const cookieStore = await cookies();
  const telefono = cookieStore.get('tenant_phone')?.value;

  if (telefono) {
    await liberarSesion(telefono).catch(() => {});
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete('tenant_phone');
  res.cookies.delete('tenant_session');
  return res;
}
