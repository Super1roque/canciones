import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validarSesion } from '@/lib/tenantService';
import { cancionesPendientes } from '@/lib/cancionCompartidaService';

// Las canciones sin pagar del tenant que todavía suenan — la cuenta las vuelve a pedir en segundo
// plano para que la tarjeta muestre una canción recién subida sin recargar la página.
export async function GET() {
  const cookieStore = await cookies();
  const telefono = cookieStore.get('tenant_phone')?.value;
  if (!telefono) return NextResponse.json({ error: 'No hay una sesión de tenant activa' }, { status: 401 });
  const tenant = await validarSesion(telefono, cookieStore.get('tenant_session')?.value);
  if (!tenant) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 401 });
  return NextResponse.json(await cancionesPendientes(telefono), { headers: { 'Cache-Control': 'no-store' } });
}
