'use client';
import { useState, useEffect, useCallback } from 'react';

export default function SoporteLink() {
  const [noLeidos, setNoLeidos] = useState(0);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/no-leidos');
      if (res.ok) {
        const data = await res.json();
        setNoLeidos(data.noLeidos ?? 0);
      }
    } catch {
      // Silencioso — se reintenta en el próximo ciclo.
    }
  }, []);

  // Misma corrección que ChatTenant: la primera carga corre siempre, sin
  // chequear visibilidad (si no, el header podría arrancar sin saber que
  // hay mensajes pendientes y nunca enterarse). El chequeo de visibilidad
  // solo aplica al polling recurrente, para no gastar batería de fondo.
  useEffect(() => {
    cargar();
    function actualizarSiVisible() {
      if (document.visibilityState === 'visible') cargar();
    }
    const intervalo = setInterval(actualizarSiVisible, 15000);
    document.addEventListener('visibilitychange', actualizarSiVisible);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', actualizarSiVisible);
    };
  }, [cargar]);

  return (
    <a
      href="/dashboard#soporte"
      style={{
        color: 'var(--cr-text)', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none',
        whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      }}
    >
      💬 Soporte
      {noLeidos > 0 && (
        <span style={{
          background: 'var(--cr-error)', color: '#fff', fontSize: '0.68rem', fontWeight: 800,
          borderRadius: 999, padding: '0.05rem 0.42rem', minWidth: '1.1rem', textAlign: 'center', lineHeight: 1.4,
        }}>
          {noLeidos}
        </span>
      )}
    </a>
  );
}
