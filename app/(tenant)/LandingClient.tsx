'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import styles from './tenant.module.css';
import { trackMetaPixel } from '@/lib/metaPixel';

// Producto pensado para Honduras — si no escriben un +código, se asume +504.
function formatearVisible(raw: string): string {
  return raw.trim();
}

export default function LandingClient() {
  const router = useRouter();
  const [paso, setPaso] = useState<'telefono' | 'esperando' | 'codigo'>('telefono');
  const [telefono, setTelefono] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [error, setError] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [rechazada, setRechazada] = useState(false);

  const [telefonoCodigo, setTelefonoCodigo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState('');

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
      // Señal de interés genuino (dejó su teléfono) para armar audiencias de
      // remarketing en Meta — separado del evento de registro real, que
      // recién se dispara cuando el admin aprueba la verificación.
      trackMetaPixel('Lead');
      // Abre WhatsApp en el mismo momento, sin esperar un click aparte —
      // antes había que tocar "Continuar" y DESPUÉS otro botón para recién
      // ahí ir a WhatsApp, y ese paso de más era donde se perdían leads que
      // nunca llegaban a mandar el mensaje. Sigue dentro del mismo gesto
      // del usuario (el submit del form), así que el navegador no lo
      // bloquea como popup.
      window.open(data.whatsappUrl, '_blank', 'noopener,noreferrer');
      abiertoWhatsappRef.current = true;
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
        trackMetaPixel('CompleteRegistration');
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

  async function handleVerificarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErrorCodigo('');
    setEnviandoCodigo(true);
    try {
      const res = await fetch('/api/tenants/verificar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: formatearVisible(telefonoCodigo), codigo }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorCodigo(data.error || 'No se pudo verificar el código'); return; }
      router.push('/crear-parodia');
    } catch {
      setErrorCodigo('Error de conexión con el servidor');
    } finally {
      setEnviandoCodigo(false);
    }
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
            <button
              type="button"
              onClick={() => { setPaso('codigo'); setErrorCodigo(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--cr-text-muted)', fontSize: '0.82rem', textDecoration: 'underline', cursor: 'pointer', marginTop: '0.25rem' }}
            >
              ¿Ya tenés un código de acceso? Ingresalo acá
            </button>
          </form>
        ) : paso === 'codigo' ? (
          <form onSubmit={handleVerificarCodigo} className={styles.formGroup}>
            <label htmlFor="telefonoCodigo">Tu número de teléfono</label>
            <input
              id="telefonoCodigo"
              type="tel"
              className={styles.input}
              placeholder="Ej: 9999-8888"
              value={telefonoCodigo}
              onChange={e => setTelefonoCodigo(e.target.value)}
              required
            />
            <label htmlFor="codigo">Código de acceso</label>
            <input
              id="codigo"
              type="text"
              inputMode="numeric"
              className={styles.input}
              placeholder="123456"
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
              required
            />
            <p className={styles.textMuted} style={{ fontSize: '0.78rem', margin: 0 }}>
              Es el código que te pasamos por WhatsApp cuando confirmamos tu número.
            </p>
            <button type="submit" className={styles.btnPrimary} disabled={enviandoCodigo} style={{ marginTop: '0.5rem' }}>
              {enviandoCodigo ? 'Verificando...' : '🔓 Entrar'}
            </button>
            {errorCodigo && <p className={styles.error}>{errorCodigo}</p>}
            <button
              type="button"
              onClick={() => { setPaso('telefono'); setErrorCodigo(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--cr-text-muted)', fontSize: '0.82rem', textDecoration: 'underline', cursor: 'pointer' }}
            >
              ← Volver
            </button>
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
                  Ya te abrimos WhatsApp con un mensaje listo para confirmar que <strong>{telefono}</strong> es tu número — solo tenés que enviarlo.
                </p>
                <button type="button" className={styles.btnSecondary} onClick={abrirWhatsapp} style={{ textDecoration: 'none' }}>
                  💬 ¿No se abrió? Tocá acá
                </button>
                <p className={styles.textMuted} style={{ fontSize: '0.82rem', margin: 0 }}>
                  Apenas confirmemos que lo enviaste, esta pantalla arranca sola.
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
