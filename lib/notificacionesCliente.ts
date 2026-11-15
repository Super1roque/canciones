'use client';
// Suscripción Web Push del tenant, compartida entre el botón del dashboard (NotificacionesTenant) y el chat de
// soporte (ChatTenant), que la pide al mandar un mensaje para que la persona se entere cuando le responden.
// Al cambiar, avisa con el evento 'notificaciones-tenant' para que los dos muestren el mismo estado.

export type EstadoNotificaciones = 'sin-soporte' | 'denegado' | 'inactivo' | 'activo';

// El navegador solo acepta la clave pública del push como Uint8Array, no
// como el string base64url que da VAPID — es la conversión estándar para
// esto (no hay forma más corta con las APIs nativas).
function claveComoUint8Array(base64: string): Uint8Array {
  const base64Normal = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64Normal);
  return Uint8Array.from([...binario].map(c => c.charCodeAt(0)));
}

export const soportaNotificaciones = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function avisarCambio(estado: EstadoNotificaciones) {
  window.dispatchEvent(new CustomEvent('notificaciones-tenant', { detail: estado }));
}

export async function estadoNotificaciones(): Promise<EstadoNotificaciones> {
  if (!soportaNotificaciones()) return 'sin-soporte';
  if (Notification.permission === 'denied') return 'denegado';
  try {
    const registro = await navigator.serviceWorker.ready;
    return (await registro.pushManager.getSubscription()) ? 'activo' : 'inactivo';
  } catch {
    return 'inactivo';
  }
}

// Pedir permiso requiere un gesto real de la persona (un clic), así que se llama directo desde el onClick, antes
// de cualquier otro await. Devuelve el estado final, o un mensaje de error si el servidor no guardó la suscripción.
export async function activarNotificaciones(): Promise<{ estado: EstadoNotificaciones; error?: string }> {
  if (!soportaNotificaciones()) return { estado: 'sin-soporte' };
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') {
    const estado = permiso === 'denied' ? 'denegado' : 'inactivo';
    avisarCambio(estado);
    return { estado };
  }
  try {
    const registro = await navigator.serviceWorker.ready;
    const suscripcion = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      // El cast es solo por una sobre-especificidad de los tipos de TS
      // (Uint8Array<ArrayBufferLike> vs. BufferSource) — en runtime es
      // un Uint8Array normal, que el navegador acepta sin problema.
      applicationServerKey: claveComoUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as BufferSource,
    });
    const res = await fetch('/api/tenants/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(suscripcion),
    });
    if (!res.ok) {
      // Sin este chequeo, un fallo acá (ej. la sesión venció) quedaba
      // invisible: el navegador SÍ quedaba suscripto pero el servidor
      // nunca se enteraba, así que nunca le iba a llegar nada — mostraba
      // "activo" sin que hubiera pasado nada de verdad.
      await suscripcion.unsubscribe().catch(() => {});
      const data = await res.json().catch(() => ({}));
      return { estado: 'inactivo', error: data.error || 'No se pudo guardar la suscripción' };
    }
    avisarCambio('activo');
    return { estado: 'activo' };
  } catch (error) {
    console.error('activar notificaciones:', error);
    return { estado: 'inactivo' };
  }
}

export async function desactivarNotificaciones(): Promise<void> {
  try {
    const registro = await navigator.serviceWorker.ready;
    const suscripcion = await registro.pushManager.getSubscription();
    if (suscripcion) {
      await fetch('/api/tenants/push', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: suscripcion.endpoint }),
      });
      await suscripcion.unsubscribe();
    }
  } finally {
    avisarCambio('inactivo');
  }
}
