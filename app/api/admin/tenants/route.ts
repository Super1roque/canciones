import { NextResponse } from 'next/server';
import { listarTodosTenants } from '@/lib/tenantService';
import { obtenerCodigoVigente } from '@/lib/verificacionService';

export async function GET() {
  const tenants = await listarTodosTenants();
  const conCodigo = await Promise.all(
    tenants.map(async t => ({ ...t, codigoAcceso: await obtenerCodigoVigente(t.telefono) }))
  );
  return NextResponse.json(conCodigo);
}
