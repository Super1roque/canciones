'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import styles from './tenant.module.css';

// Producto pensado para Honduras — si no escriben un +código, se asume +504.
function formatearVisible(raw: string): string {
  return raw.trim();
}

export default function LandingClient() {
  const router = useRouter();
  const [paso, setPaso] = useState<'telefono' | 'esperando'>('telefono');
  const [telefono, setTelefono] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [error, setError] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [rechazada, setRechazada] = useState(false);

  const verificacionIdRef = useRef<string | null>(null);
  const abiertoWhatsappRef = useRef(false);

  async function handleSolicitar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setRechazada(false);
    setEnviando(true);
    try {
      const res = await fetch('/api/tenants/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: formatearVisible(telefono) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'No se pudo enviar la solicitud'); return; }
      if (data.yaLogueado) { router.push('/crear-parodia'); return; }
      verificacionIdRef.current = data.id;
      setWhatsappUrl(data.whatsappUrl);
      setPaso('esperando');
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setEnviando(false);
    }
  }

  async function revisarEstado() {
    const id = verificacionIdRef.current;
    if (!id) return;
    setRevisando(true);
    try {
      const res = await fetch(`/api/tenants/verificar/${id}`);
      const data = await res.json();
      if (data.estado === 'aprobada') {
        router.push('/crear-parodia');
        return;
      }
      if (data.estado === 'rechazada') {
        setRechazada(true);
      }
    } catch {
      // Silencioso — se reintenta en el próximo ciclo.
    } finally {
      setRevisando(false);
    }
  }

  // Polling mientras se espera la aprobación — cada 4s, más seguido que el
  // del dashboard porque acá la persona está mirando la pantalla en vivo
  // esperando poder arrancar.
  useEffect(() => {
    if (paso !== 'esperando') return;
    const id = setInterval(revisarEstado, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso]);

  function abrirWhatsapp() {
    abiertoWhatsappRef.current = true;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }

  function cambiarNumero() {
    setPaso('telefono');
    setError('');
    setRechazada(false);
    verificacionIdRef.current = null;
  }

  return (
    <main className={styles.main}>
      <div className={styles.panel} style={{ padding: '2.5rem 2rem', maxWidth: 440, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
          <form onSubmit={handleSolicitar} className={styles.formGroup}>
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
              Te vamos a pedir que confirmes por WhatsApp que es tuyo. Ahí mismo te entregamos tu parodia terminada.
            </p>
            <button type="submit" className={styles.btnPrimary} disabled={enviando} style={{ marginTop: '0.5rem' }}>
              {enviando ? 'Un momento...' : '📲 Continuar'}
            </button>
            {error && <p className={styles.error}>{error}</p>}
          </form>
        ) : (
          <div className={styles.formGroup} style={{ alignItems: 'center', textAlign: 'center' }}>
            {rechazada ? (
              <>
                <span style={{ fontSize: '2rem' }}>😕</span>
                <p className={styles.error} style={{ textAlign: 'center' }}>
                  No pudimos confirmar ese número. Revisá que le hayas escrito desde el WhatsApp de ese mismo teléfono.
                </p>
                <button type="button" className={styles.btnSecondary} onClick={cambiarNumero}>
                  ← Intentar de nuevo
                </button>
              </>
            ) : (
              <>
                <p style={{ margin: 0 }}>
                  Tocá el botón para confirmar por WhatsApp que <strong>{telefono}</strong> es tu número.
                </p>
                <button type="button" className={styles.btnPrimary} onClick={abrirWhatsapp} style={{ textDecoration: 'none' }}>
                  💬 Confirmar por WhatsApp
                </button>
                <p className={styles.textMuted} style={{ fontSize: '0.82rem', margin: 0 }}>
                  Se va a abrir WhatsApp con un mensaje ya escrito — solo tenés que enviarlo. Apenas lo confirmemos, esta pantalla arranca sola.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--cr-text-muted)', fontSize: '0.82rem' }}>
                  <span className="spinner" style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid var(--cr-border)', borderTopColor: 'var(--cr-gold)',
                    display: 'inline-block', animation: 'spin 0.8s linear infinite',
                  }} />
                  Esperando confirmación...
                </div>
                <button type="button" className={styles.btnSecondary} onClick={revisarEstado} disabled={revisando}>
                  {revisando ? 'Revisando...' : '🔄 Ya escribí, revisar ahora'}
                </button>
                <button type="button" className={styles.btnSecondary} onClick={cambiarNumero}>
                  ← Cambiar número
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
    </main>
  );
}
