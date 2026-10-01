'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './tenant.module.css';
import { trackMetaPixel } from '@/lib/metaPixel';

export default function LandingClient() {
  // El link de "alta rápida"/reactivación (ver admin/tenants y
  // admin/reactivar) manda ?telefono=X — precarga el campo para que la
  // persona no tenga que volver a escribir su número, pero igual tiene que
  // tocar "Entrar" ella misma (nada de auto-submit): si el link se abre
  // solo como preview dentro de WhatsApp antes de que la persona lo toque,
  // un auto-submit le "gastaría" el login a ese preview en vez de a ella.
  const searchParams = useSearchParams();
  const [telefono, setTelefono] = useState(() => searchParams.get('telefono') ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setWhatsappUrl('');
    setEnviando(true);
    try {
      const res = await fetch('/api/tenants/entrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: telefono.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo iniciar sesión');
        if (data.whatsappUrl) setWhatsappUrl(data.whatsappUrl);
        return;
      }
      trackMetaPixel('CompleteRegistration');
      // A /dashboard, no a /crear-parodia directo — dashboard/page.tsx ya
      // decide solo si corresponde mandarlo a crear su primera canción
      // (usaGratis) o mostrarle su cuenta (saldo, pedir otra canción) si
      // ya es cliente con historial. Antes esto siempre caía en
      // crear-parodia, así que alguien con saldo cargado entraba directo
      // al formulario en vez de ver su cuenta primero.
      //
      // Recarga real de página (no router.push) — la cookie recién se
      // guardó y una navegación client-side puede ganarle a que quede
      // asentada en el navegador integrado de WhatsApp.
      window.location.href = '/dashboard';
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className={styles.main} style={{ position: 'relative', zIndex: 0, overflow: 'hidden' }}>
      <video className={styles.heroVideo} autoPlay muted loop playsInline poster="/hero/mariachi-poster.jpg">
        <source src="/hero/mariachi.mp4" type="video/mp4" />
      </video>
      <div className={styles.heroOverlay} />

      <div className={styles.panelGlass} style={{ position: 'relative', padding: '2.5rem 2rem', maxWidth: 400, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
          <button type="submit" className={styles.btnPrimary} disabled={enviando} style={{ marginTop: '0.5rem' }}>
            {enviando ? 'Entrando...' : '🎤 Entrar'}
          </button>
          {error && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p className={styles.error} style={{ margin: 0 }}>{error}</p>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.btnSecondary}
                  style={{ textDecoration: 'none' }}
                >
                  💬 Escribirnos por WhatsApp
                </a>
              )}
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
