import { NextResponse } from 'next/server';
import { guardarSuscripcionPush, eliminarSuscripcionPush } from '@/lib/pushService';
import { soloAdmin } from '@/lib/adminServidor';

export async function POST(request: Request) {
  const negado = await soloAdmin(request);
  if (negado) return negado;
  try {
    const subscription = await request.json();
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 });
    }
    await guardarSuscripcionPush(subscription);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('admin/push POST:', msg);
    return NextResponse.json({ error: 'Error al guardar la suscripción' }, { status: 500 });
  }
}

// Se llama al desactivar las notificaciones desde el navegador — borra la
// suscripción guardada para no seguir intentando mandarle avisos.
export async function DELETE(request: Request) {
  const negado = await soloAdmin(request);
  if (negado) return negado;
  try {
    const { endpoint } = await request.json();
    if (!endpoint) return NextResponse.json({ error: 'Falta el endpoint' }, { status: 400 });
    await eliminarSuscripcionPush(endpoint);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('admin/push DELETE:', msg);
    return NextResponse.json({ error: 'Error al borrar la suscripción' }, { status: 500 });
  }
}
