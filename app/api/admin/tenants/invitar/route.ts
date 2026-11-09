import { NextResponse } from 'next/server';
import { guardarInvitacionReactivacion } from '@/lib/tenantService';
import { soloAdmin } from '@/lib/adminServidor';

export async function POST(request: Request) {
  const negado = await soloAdmin(request);
  if (negado) return negado;
  try {
    const { telefono } = await request.json();
    if (!telefono) return NextResponse.json({ error: 'Falta el teléfono' }, { status: 400 });

    await guardarInvitacionReactivacion(telefono);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('tenants/invitar:', msg);
    return NextResponse.json({ error: 'Error al marcar la invitación' }, { status: 500 });
  }
}
