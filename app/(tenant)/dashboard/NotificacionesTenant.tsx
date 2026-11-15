'use client';
import { useState, useEffect } from 'react';
import styles from '../tenant.module.css';
import { estadoNotificaciones, activarNotificaciones, desactivarNotificaciones, type EstadoNotificaciones } from '@/lib/notificacionesCliente';

type Estado = 'cargando' | EstadoNotificaciones | 'activando' | 'error';

// Avisa cuando la canción pedida está lista (ver avisarCancionLista en
// lib/pushService.ts, disparado al marcarla "entregada" desde el admin) y
// cuando el admin responde en el chat de soporte (avisarRespuestaSoporte),
// aunque no tenga la app abierta — mismo mecanismo Web Push que ya usa el
// admin para enterarse de mensajes nuevos. Pedir permiso requiere un gesto
// real de la persona (este botón o el Enviar del chat), no se puede activar
// solo ni con el load de la página.
export default function NotificacionesTenant() {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    estadoNotificaciones().then(setEstado);
    // Si se activan desde el chat, este botón se entera sin recargar.
    const alCambiar = (e: Event) => setEstado((e as CustomEvent<EstadoNotificaciones>).detail);
    window.addEventListener('notificaciones-tenant', alCambiar);
    return () => window.removeEventListener('notificaciones-tenant', alCambiar);
  }, []);

  async function activar() {
    setEstado('activando');
    const r = await activarNotificaciones();
    if (r.error) { setErrorMsg(r.error); setEstado('error'); return; }
    setEstado(r.estado);
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
      <button type="button" className={styles.btnSecondary} style={{ fontSize: '0.82rem', width: '100%' }} onClick={desactivarNotificaciones}>
        🔔 Te avisamos cuando tu canción esté lista o te respondamos — desactivar
      </button>
    );
  }

  return (
    <button type="button" className={styles.btnPrimary} style={{ fontSize: '0.85rem', width: '100%' }} disabled={estado === 'activando'} onClick={activar}>
      {estado === 'activando' ? 'Activando…' : '🔔 Avisame cuando mi canción esté lista o me respondan'}
    </button>
  );
}
