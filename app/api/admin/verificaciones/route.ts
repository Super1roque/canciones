import { NextResponse } from 'next/server';
import { listarVerificacionesPendientes, resolverVerificacion } from '@/lib/verificacionService';

export async function GET() {
  const verificaciones = await listarVerificacionesPendientes();
  return NextResponse.json(verificaciones);
}

export async function PATCH(request: Request) {
  try {
    const { id, aprobar } = await request.json();
    if (!id || typeof aprobar !== 'boolean') {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    await resolverVerificacion(id, aprobar);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';

    if (msg === 'VERIFICACION_YA_RESUELTA') {
      return NextResponse.json({ error: 'Esta solicitud ya fue resuelta' }, { status: 409 });
    }

    console.error('resolverVerificacion:', msg);
    return NextResponse.json({ error: 'Error al resolver la solicitud' }, { status: 500 });
  }
}
