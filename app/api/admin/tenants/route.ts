import { NextResponse } from 'next/server';
import { listarTodosTenants } from '@/lib/tenantService';

export async function GET() {
  const tenants = await listarTodosTenants();
  return NextResponse.json(tenants);
}
