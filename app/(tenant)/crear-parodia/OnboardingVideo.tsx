'use client';
import { useState } from 'react';
import styles from '../tenant.module.css';

const VIDEO_URL = 'https://storage.googleapis.com/canciones-56dab.firebasestorage.app/onboarding/corridos-instructivo.mp4';

// Se muestra una sola vez, la primera vez que un tenant recién aprobado
// entra a /crear-parodia — se marca como visto en Firestore (no
// localStorage) para que no vuelva a aparecer ni siquiera en otro
// dispositivo o si borra los datos del navegador.
export default function OnboardingVideo() {
  const [visible, setVisible] = useState(true);

  function cerrar() {
    setVisible(false);
    fetch('/api/tenants/onboarding', { method: 'POST' }).catch(() => {});
  }

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div className={styles.panel} style={{ maxWidth: 380, width: '100%', padding: '1.25rem', position: 'relative' }}>
        <button
          onClick={cerrar}
          aria-label="Cerrar"
          style={{
            position: 'absolute', top: '0.75rem', right: '0.75rem', zIndex: 1,
            background: 'var(--cr-surface-2)', border: '2px solid var(--cr-border)', borderRadius: '50%',
            width: 32, height: 32, color: 'var(--cr-text)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1,
          }}
        >
          ✕
        </button>
        <div style={{ textAlign: 'center', marginBottom: '0.85rem' }}>
          <span className={styles.badge}>🤔 ¿Y ahora qué hago?</span>
        </div>
        <video
          src={VIDEO_URL}
          controls
          playsInline
          onEnded={cerrar}
          style={{ width: '100%', borderRadius: 12, display: 'block', background: '#000' }}
        />
        <p className={styles.textMuted} style={{ fontSize: '0.78rem', textAlign: 'center', margin: '0.75rem 0 0' }}>
          Mirá este video rápido y arrancá con tu primera canción 🎸
        </p>
      </div>
    </div>
  );
}
