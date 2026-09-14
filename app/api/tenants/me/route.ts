import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { obtenerTenant } from '@/lib/tenantService';

export async function GET() {
  const cookieStore = await cookies();
  const telefono = cookieStore.get('tenant_phone')?.value;

  if (!telefono) {
    return NextResponse.json({ error: 'No hay una sesión de tenant activa' }, { status: 401 });
  }

  const tenant = await obtenerTenant(telefono);
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 401 });
  }

  return NextResponse.json(tenant);
}
