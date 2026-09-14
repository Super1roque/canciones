'use client';
import { useState, useEffect } from 'react';
import styles from '../tenant.module.css';
import type { Tenant } from '@/lib/tenantService';

type Cancion = { id: string; nombre: string; estilo: string; descripcionEstilo?: string; direccionGenerador?: string; letra: string };
type ParodiaResult = { cancion_base: string; estilo: string; descripcionEstilo: string; direccionGenerador: string; historia: string; parodia: string; modoPrueba?: boolean };
type Toast = { msg: string; type: 'success' | 'error' } | null;

export default function CrearParodiaClient({ tenant }: { tenant: Tenant }) {
  const cuotaAgotada = tenant.cancionesGratisUsadas >= tenant.cancionesGratisLimite;

  const [canciones, setCanciones] = useState<Cancion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [seleccionada, setSeleccionada] = useState<Cancion | null>(null);
  const [historia, setHistoria] = useState('');
  const [generando, setGenerando] = useState(false);
  const [parodiaActual, setParodiaActual] = useState<ParodiaResult | null>(null);
  const [letraEditada, setLetraEditada] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    if (cuotaAgotada) { setCargando(false); return; }
    fetch('/api/canciones')
      .then(res => res.json())
      .then(data => setCanciones(Array.isArray(data) ? data : []))
      .catch(() => showToast('No se pudo cargar la lista de canciones', 'error'))
      .finally(() => setCargando(false));
  }, [cuotaAgotada]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
  }

  function seleccionarCancion(c: Cancion) {
    setSeleccionada(c);
    setParodiaActual(null);
    setLetraEditada('');
    setEnviado(false);
  }

  async function handleGenerar() {
    if (!seleccionada) { showToast('Primero elegí una canción', 'error'); return; }
    if (historia.trim().length < 2) { showToast('Contanos la historia o al menos un nombre', 'error'); return; }

    setGenerando(true);
    setParodiaActual(null);
    try {
      const res = await fetch('/api/parodias/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancionId: seleccionada.id, historia }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Error al generar la parodia', 'error'); return; }
      setParodiaActual(data);
      setLetraEditada(data.parodia);
      setEnviado(false);
    } catch {
      showToast('Error de conexión con el servidor', 'error');
    } finally {
      setGenerando(false);
    }
  }

  async function handleEnviar() {
    if (!parodiaActual) return;
    if (letraEditada.trim().length < 2) { showToast('La letra no puede quedar vacía', 'error'); return; }

    setEnviando(true);
    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cancion_base: parodiaActual.cancion_base,
          estilo: parodiaActual.estilo,
          descripcionEstilo: parodiaActual.descripcionEstilo,
          direccionGenerador: parodiaActual.direccionGenerador,
          historia: parodiaActual.historia,
          parodia: letraEditada,
        }),
      });
      if (!res.ok) { const d = await res.json(); showToast(d.error || 'Error al enviar el pedido', 'error'); return; }
      setEnviado(true);
      showToast('¡Pedido enviado!', 'success');
    } catch {
      showToast('Error de conexión con el servidor', 'error');
    } finally {
      setEnviando(false);
    }
  }

  const cancionesFiltradas = canciones.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.estilo.toLowerCase().includes(busqueda.toLowerCase())
  );

  if (cuotaAgotada && !enviado) {
    return (
      <main className={styles.main}>
        <div className={styles.panel} style={{ padding: '2.5rem 2rem', maxWidth: 420, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <span style={{ fontSize: '2.5rem' }}>🎉</span>
          <h2 className={styles.heroTitle} style={{ fontSize: '1.4rem', margin: 0 }}>Ya usaste tu canción gratis</h2>
          <p className={styles.textMuted}>Muy pronto vas a poder pedir canciones adicionales. ¡Gracias por probarlo!</p>
        </div>
      </main>
    );
  }

  if (enviado) {
    return (
      <main className={styles.main}>
        <div className={styles.panel} style={{ padding: '3rem 2rem', maxWidth: 460, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: '3rem' }}>🎉</span>
          <h2 className={styles.heroTitle} style={{ fontSize: '1.4rem', margin: 0 }}>¡Tu pedido fue enviado!</h2>
          <p className={styles.textMuted} style={{ maxWidth: 380 }}>
            Ya tenemos la letra de tu parodia de &quot;{parodiaActual?.cancion_base}&quot;. Te la vamos a entregar por WhatsApp.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main} style={{ alignItems: 'flex-start', paddingTop: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: '1.25rem', width: '100%', maxWidth: 980, alignItems: 'start' }}>
        <aside className={styles.panel} style={{ padding: '1rem' }}>
          <h2 className={styles.heroTitle} style={{ fontSize: '1rem', margin: '0 0 0.75rem' }}>1. Elegí una canción</h2>
          <input
            type="search"
            className={styles.input}
            placeholder="Buscar canción o estilo…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: '0.75rem' }}
          />
          <div style={{ maxHeight: 480, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {cargando ? (
              <p className={styles.textMuted} style={{ fontSize: '0.85rem' }}>Cargando canciones…</p>
            ) : cancionesFiltradas.length === 0 ? (
              <p className={styles.textMuted} style={{ fontSize: '0.85rem' }}>Sin resultados para &quot;{busqueda}&quot;</p>
            ) : (
              cancionesFiltradas.map(c => (
                <button
                  key={c.id}
                  onClick={() => seleccionarCancion(c)}
                  style={{
                    textAlign: 'left', padding: '0.6rem 0.8rem', borderRadius: 10, cursor: 'pointer',
                    border: `2px solid ${seleccionada?.id === c.id ? 'var(--cr-gold)' : 'transparent'}`,
                    background: seleccionada?.id === c.id ? 'rgba(242,183,5,0.12)' : 'var(--cr-surface-2)',
                    color: 'var(--cr-text)', fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.nombre}</div>
                  <div className={styles.textMuted} style={{ fontSize: '0.78rem' }}>{c.estilo}</div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className={styles.panel} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {seleccionada ? (
            <>
              <div>
                <h3 className={styles.heroTitle} style={{ fontSize: '1.2rem', margin: '0 0 0.4rem' }}>{seleccionada.nombre}</h3>
                <span className={styles.badge}>{seleccionada.estilo}</span>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="historia">2. Contanos la historia para tu parodia</label>
                <textarea
                  id="historia"
                  rows={5}
                  className={styles.textarea}
                  placeholder="Ej: Un estudiante que odia los lunes, llega tarde a clases, se olvidó la tarea y su maestro es muy estricto...&#10;&#10;💡 También podés escribir solo el nombre de una persona y la parodia va a girar en torno a ella."
                  value={historia}
                  onChange={e => setHistoria(e.target.value)}
                />
              </div>

              <button className={styles.btnPrimary} onClick={handleGenerar} disabled={generando}>
                {generando ? 'Generando...' : '✨ Generar parodia'}
              </button>

              {parodiaActual && (
                <div className={styles.formGroup}>
                  <h3 className={styles.heroTitle} style={{ fontSize: '1.1rem', margin: '0.5rem 0 0' }}>3. Revisá y ajustá la letra</h3>
                  <textarea
                    rows={16}
                    className={styles.textarea}
                    value={letraEditada}
                    onChange={e => setLetraEditada(e.target.value)}
                    style={{ fontFamily: "'Fira Mono', monospace", fontSize: '0.85rem', lineHeight: 1.75 }}
                  />
                  <span className={styles.textMuted} style={{ fontSize: '0.78rem' }}>Podés editar la letra antes de enviarla</span>
                  <button className={styles.btnPrimary} onClick={handleEnviar} disabled={enviando}>
                    {enviando ? 'Enviando...' : '📨 Enviar pedido'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <span style={{ fontSize: '2rem' }}>🎶</span>
              <p className={styles.textMuted} style={{ marginTop: '0.5rem' }}>Elegí una canción de la lista para empezar</p>
            </div>
          )}
        </section>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 300,
          background: 'var(--cr-surface-2)', border: `2px solid ${toast.type === 'error' ? 'var(--cr-error)' : 'var(--cr-green)'}`,
          color: toast.type === 'error' ? 'var(--cr-error)' : 'var(--cr-green)',
          borderRadius: 12, padding: '0.75rem 1.25rem', fontSize: '0.85rem', fontWeight: 600,
        }}>
          {toast.msg}
        </div>
      )}
    </main>
  );
}
