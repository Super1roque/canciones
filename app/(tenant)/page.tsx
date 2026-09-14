'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './tenant.module.css';

export default function Landing() {
  const router = useRouter();
  const [telefono, setTelefono] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al registrarte'); return; }
      router.push('/crear-parodia');
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setEnviando(false);
    }
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

        <form onSubmit={handleSubmit} className={styles.formGroup}>
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
            Ahí te vamos a entregar tu parodia terminada, por WhatsApp.
          </p>
          <button type="submit" className={styles.btnPrimary} disabled={enviando} style={{ marginTop: '0.5rem' }}>
            {enviando ? 'Entrando...' : '🎤 Empezar mi parodia gratis'}
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </form>
      </div>
    </main>
  );
}
