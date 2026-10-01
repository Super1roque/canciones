import { NextResponse } from 'next/server';
import { listarTodosTenants } from '@/lib/tenantService';

export async function GET() {
  const tenants = await listarTodosTenants();
  // No se manda sesionId tal cual al navegador (es un token interno) — el
  // admin solo necesita saber si hay una sesión activa o no, para decidir
  // si mostrar el botón de liberarla.
  return NextResponse.json(tenants.map(({ sesionId, ...resto }) => ({ ...resto, sesionActiva: !!sesionId })));
}
