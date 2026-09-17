import { NextResponse } from 'next/server';
import { listarVerificacionesPendientes, resolverVerificacion } from '@/lib/verificacionService';
import { obtenerOCrearTenant } from '@/lib/tenantService';

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

    const verificacion = await resolverVerificacion(id, aprobar);

    // La cuenta se crea acá mismo, no solo cuando el navegador del tenant
    // hace polling y ve "aprobada" — si esa persona ya cerró la pestaña o
    // dejó de esperar antes de que el admin aprobara, esta era la única
    // vez que la cuenta se llegaba a crear. Ahora queda creada apenas se
    // aprueba, sin depender de que nadie siga mirando la pantalla.
    if (aprobar) await obtenerOCrearTenant(verificacion.telefono);

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
