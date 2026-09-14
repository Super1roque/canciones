'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { auth } from '@/lib/firebaseClient';
import styles from './tenant.module.css';

// Producto pensado para Honduras — si no escriben un +código, se asume +504.
function formatearE164(raw: string): string {
  const limpio = raw.trim();
  if (limpio.startsWith('+')) return limpio.replace(/[^\d+]/g, '');
  return '+504' + limpio.replace(/\D/g, '');
}

function mensajeErrorEnvio(codigo: string): string {
  if (codigo === 'auth/invalid-phone-number') return 'Ese número no parece válido — revisalo.';
  if (codigo === 'auth/too-many-requests') return 'Demasiados intentos. Probá de nuevo en un rato.';
  return 'No se pudo enviar el código. Intentá de nuevo.';
}

function mensajeErrorCodigo(codigo: string): string {
  if (codigo === 'auth/invalid-verification-code') return 'Código incorrecto — revisalo.';
  if (codigo === 'auth/code-expired') return 'El código venció. Pedí uno nuevo.';
  return 'No se pudo verificar el código.';
}

export default function LandingClient() {
  const router = useRouter();
  const [paso, setPaso] = useState<'telefono' | 'codigo'>('telefono');
  const [telefono, setTelefono] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState('');

  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const confirmacionRef = useRef<ConfirmationResult | null>(null);

  async function handleEnviarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      }
      const confirmacion = await signInWithPhoneNumber(auth, formatearE164(telefono), recaptchaRef.current);
      confirmacionRef.current = confirmacion;
      setPaso('codigo');
    } catch (err: unknown) {
      const codigoError = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
      setError(mensajeErrorEnvio(codigoError));
    } finally {
      setEnviando(false);
    }
  }

  async function handleVerificarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setVerificando(true);
    try {
      if (!confirmacionRef.current) throw new Error('sin confirmación pendiente');
      const credencial = await confirmacionRef.current.confirm(codigo);
      const idToken = await credencial.user.getIdToken();

      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'No se pudo completar el registro'); return; }
      router.push('/crear-parodia');
    } catch (err: unknown) {
      const codigoError = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
      setError(mensajeErrorCodigo(codigoError));
    } finally {
      setVerificando(false);
    }
  }

  function cambiarNumero() {
    setPaso('telefono');
    setCodigo('');
    setError('');
    confirmacionRef.current = null;
  }

  return (
    <main className={styles.main}>
      <div className={styles.panel} style={{ padding: '2.5rem 2rem', maxWidth: 420, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <div style={{ fontSize: '2.75rem', marginBottom: '0.5rem' }}>🤠🎶</div>
          <h1 className={styles.heroTitle} style={{ fontSize: '1.8rem', margin: '0 0 0.6rem' }}>
            Tu historia, hecha corrido
          </h1>
          <p className={styles.textMuted} style={{ fontSize: '0.95rem', lineHeight: 1.5 }}>
            Contanos tu historia y te la convertimos en la parodia de tu canción favorita.
            <br />
            <strong style={{ color: 'var(--cr-gold)' }}>Tu primera canción es gratis 🎁</strong>
          </p>
        </div>

        {paso === 'telefono' ? (
          <form onSubmit={handleEnviarCodigo} className={styles.formGroup}>
            <label htmlFor="telefono">Tu número de teléfono</label>
            <input
              id="telefono"
              type="tel"
              className={styles.input}
              placeholder="Ej: 9999-8888"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              required
            />
            <p className={styles.textMuted} style={{ fontSize: '0.78rem', margin: 0 }}>
              Te mandamos un código por SMS para confirmar que es tuyo. Ahí mismo te vamos a entregar tu parodia terminada, por WhatsApp.
            </p>
            <button type="submit" className={styles.btnPrimary} disabled={enviando} style={{ marginTop: '0.5rem' }}>
              {enviando ? 'Enviando...' : '📲 Enviarme el código'}
            </button>
            {error && <p className={styles.error}>{error}</p>}
          </form>
        ) : (
          <form onSubmit={handleVerificarCodigo} className={styles.formGroup}>
            <label htmlFor="codigo">Código que te llegó por SMS</label>
            <input
              id="codigo"
              type="text"
              inputMode="numeric"
              className={styles.input}
              placeholder="123456"
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
              style={{ textAlign: 'center', fontSize: '1.3rem', letterSpacing: '0.3em' }}
              required
            />
            <button type="submit" className={styles.btnPrimary} disabled={verificando} style={{ marginTop: '0.5rem' }}>
              {verificando ? 'Verificando...' : '🎤 Empezar mi parodia gratis'}
            </button>
            {error && <p className={styles.error}>{error}</p>}
            <button type="button" className={styles.btnSecondary} onClick={cambiarNumero} style={{ marginTop: '0.25rem' }}>
              ← Cambiar número
            </button>
          </form>
        )}
      </div>

      <div id="recaptcha-container" />
    </main>
  );
}
