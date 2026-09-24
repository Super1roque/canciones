'use client';
import { useState, useRef } from 'react';
import styles from '../tenant.module.css';

const VIDEO_URL = 'https://storage.googleapis.com/canciones-56dab.firebasestorage.app/onboarding/corridos-instructivo.mp4';
// Los primeros segundos son el dashboard (saldo, "Comprar créditos") —
// para alguien que todavía no probó la app, eso distrae del objetivo del
// video (mostrarle cómo pedir su canción). Arranca en el segundo exacto
// donde empieza "1. Elegí una pista para tu canción".
const INICIO_SEG = 7.5;

// Se muestra una sola vez, la primera vez que un tenant recién aprobado
// entra a /crear-parodia — se marca como visto en Firestore (no
// localStorage) para que no vuelva a aparecer ni siquiera en otro
// dispositivo o si borra los datos del navegador.
export default function OnboardingVideo() {
  const [visible, setVisible] = useState(true);
  const [reproduciendo, setReproduciendo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  function cerrar() {
    setVisible(false);
    fetch('/api/tenants/onboarding', { method: 'POST' }).catch(() => {});
  }

  function reproducir() {
    videoRef.current?.play();
  }

  function alCargarMetadata() {
    if (videoRef.current) videoRef.current.currentTime = INICIO_SEG;
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
        <div style={{ position: 'relative' }}>
          <video
            ref={videoRef}
            src={VIDEO_URL}
            controls
            playsInline
            onLoadedMetadata={alCargarMetadata}
            onPlay={() => setReproduciendo(true)}
            onPause={() => setReproduciendo(false)}
            onEnded={cerrar}
            style={{ width: '100%', borderRadius: 12, display: 'block', background: '#000' }}
          />
          {!reproduciendo && (
            <button
              onClick={reproducir}
              aria-label="Reproducir video"
              style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: 76, height: 76, borderRadius: '50%',
                background: 'rgba(242, 183, 5, 0.92)', border: '3px solid rgba(253, 243, 224, 0.9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
              }}
            >
              <span style={{
                width: 0, height: 0, marginLeft: 6,
                borderTop: '16px solid transparent', borderBottom: '16px solid transparent',
                borderLeft: '26px solid #3a1216',
              }} />
            </button>
          )}
        </div>
        <p className={styles.textMuted} style={{ fontSize: '0.78rem', textAlign: 'center', margin: '0.75rem 0 0' }}>
          Mirá este video rápido y arrancá con tu primera canción 🎸
        </p>
      </div>
    </div>
  );
}
