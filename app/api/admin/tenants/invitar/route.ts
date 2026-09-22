import { NextResponse } from 'next/server';
import { guardarInvitacionReactivacion } from '@/lib/tenantService';

export async function POST(request: Request) {
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
