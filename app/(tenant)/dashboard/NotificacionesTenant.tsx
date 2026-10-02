'use client';
import { useState, useEffect } from 'react';
import styles from '../tenant.module.css';

type Estado = 'cargando' | 'sin-soporte' | 'denegado' | 'inactivo' | 'activando' | 'activo' | 'error';

// El navegador solo acepta la clave pública del push como Uint8Array, no
// como el string base64url que da VAPID — es la conversión estándar para
// esto (no hay forma más corta con las APIs nativas).
function claveComoUint8Array(base64: string): Uint8Array {
  const base64Normal = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64Normal);
  return Uint8Array.from([...binario].map(c => c.charCodeAt(0)));
}

// Avisa cuando la canción pedida está lista (ver avisarCancionLista en
// lib/pushService.ts, disparado al marcarla "entregada" desde el admin),
// aunque no tenga la app abierta — mismo mecanismo Web Push que ya usa el
// admin para enterarse de mensajes nuevos del chat de soporte. Pedir
// permiso requiere un gesto real de la persona (este botón), no se puede
// activar solo ni con el load de la página.
export default function NotificacionesTenant() {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setEstado('sin-soporte'); return; }
      if (Notification.permission === 'denied') { setEstado('denegado'); return; }
      try {
        const registro = await navigator.serviceWorker.ready;
        const suscripcion = await registro.pushManager.getSubscription();
        setEstado(suscripcion ? 'activo' : 'inactivo');
      } catch {
        setEstado('inactivo');
      }
    })();
  }, []);

  async function activar() {
    setEstado('activando');
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') { setEstado('denegado'); return; }

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
        setErrorMsg(data.error || 'No se pudo guardar la suscripción');
        setEstado('error');
        return;
      }
      setEstado('activo');
    } catch (error) {
      console.error('activar notificaciones:', error);
      setEstado('inactivo');
    }
  }

  async function desactivar() {
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
      setEstado('inactivo');
    }
  }

  if (estado === 'cargando' || estado === 'sin-soporte') return null;

  if (estado === 'denegado') {
    return (
      <p className={styles.textMuted} style={{ fontSize: '0.76rem', margin: 0 }}>
        🔕 Bloqueaste las notificaciones — para activarlas, habilitalas desde el candado/ícono de la barra de direcciones.
      </p>
    );
  }

  if (estado === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <p className={styles.error} style={{ fontSize: '0.78rem', margin: 0 }}>⚠️ {errorMsg} — recargá la página y probá de nuevo.</p>
        <button type="button" className={styles.btnPrimary} style={{ fontSize: '0.85rem', width: '100%' }} onClick={activar}>
          🔔 Reintentar
        </button>
      </div>
    );
  }

  if (estado === 'activo') {
    return (
      <button type="button" className={styles.btnSecondary} style={{ fontSize: '0.82rem', width: '100%' }} onClick={desactivar}>
        🔔 Te vamos a avisar cuando esté lista — desactivar
      </button>
    );
  }

  return (
    <button type="button" className={styles.btnPrimary} style={{ fontSize: '0.85rem', width: '100%' }} disabled={estado === 'activando'} onClick={activar}>
      {estado === 'activando' ? 'Activando…' : '🔔 Avisame cuando mi canción esté lista'}
    </button>
  );
}
