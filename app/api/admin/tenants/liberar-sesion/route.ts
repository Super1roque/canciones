import { NextResponse } from 'next/server';
import { liberarSesion } from '@/lib/tenantService';

// Se usa cuando un tenant avisa (por soporte o WhatsApp) que quedó trabado
// afuera de su cuenta — perdió el celular, lo formateó, etc. — y el bloqueo
// de "ya hay una sesión abierta en otro lado" no lo deja volver a entrar.
export async function POST(request: Request) {
  try {
    const { telefono } = await request.json();
    if (!telefono) return NextResponse.json({ error: 'Falta el teléfono' }, { status: 400 });
    await liberarSesion(telefono);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('liberar-sesion:', msg);
    return NextResponse.json({ error: 'Error al liberar la sesión' }, { status: 500 });
  }
}
