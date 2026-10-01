'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import styles from '../tenant.module.css';
import type { Mensaje } from '@/lib/chatService';

function formatHora(iso: string) {
  return new Date(iso).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ChatTenant() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [cargado, setCargado] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/mensajes');
      if (res.ok) setMensajes(await res.json());
    } catch {
      // Silencioso — se reintenta en el próximo ciclo.
    } finally {
      setCargado(true);
    }
  }, []);

  // Mismo patrón de polling que el resto del dashboard (ver
  // DashboardClient): cada 15s y al volver a la pestaña, para que un
  // mensaje del admin aparezca sin recargar la página. A diferencia de
  // DashboardClient, acá no hay datos iniciales del servidor — si la
  // carga de montaje también se saltara por estar oculta (ej. la pestaña
  // se abrió en segundo plano), el panel quedaría en "Cargando…" para
  // siempre, así que esa primera llamada corre siempre, sin chequear
  // visibilidad; el chequeo solo aplica al polling recurrente.
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

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight });
  }, [mensajes]);

  async function enviar() {
    const textoLimpio = texto.trim();
    if (!textoLimpio && !archivo) return;
    setEnviando(true);
    try {
      const formData = new FormData();
      if (textoLimpio) formData.append('texto', textoLimpio);
      if (archivo) formData.append('imagen', archivo);

      const res = await fetch('/api/chat/mensajes', { method: 'POST', body: formData });
      if (res.ok) {
        const nuevo = await res.json();
        setMensajes(prev => [...prev, nuevo]);
        setTexto('');
        setArchivo(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div id="soporte" className={styles.panel} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', scrollMarginTop: '1rem' }}>
      <h2 className={styles.heroTitle} style={{ fontSize: '1.1rem', margin: 0 }}>💬 Soporte</h2>
      <p className={styles.textMuted} style={{ fontSize: '0.82rem', margin: 0 }}>
        Escribinos tu consulta o mandá una foto (por ejemplo, el comprobante de un depósito).
      </p>

      <div
        ref={listaRef}
        style={{
          display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 140, maxHeight: 320, overflowY: 'auto',
          background: 'var(--cr-surface-2)', border: '2px solid var(--cr-border)', borderRadius: 10, padding: '0.75rem',
        }}
      >
        {!cargado ? (
          <p className={styles.textMuted} style={{ margin: 0, fontSize: '0.82rem' }}>Cargando…</p>
        ) : mensajes.length === 0 ? (
          <p className={styles.textMuted} style={{ margin: 'auto', fontSize: '0.85rem', textAlign: 'center' }}>
            💬 Acá vas a ver la conversación.<br />Escribí tu primer mensaje abajo.
          </p>
        ) : (
          mensajes.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.autor === 'tenant' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '78%', borderRadius: 12, padding: '0.5rem 0.75rem',
                background: m.autor === 'tenant' ? 'var(--cr-gold)' : 'var(--cr-surface)',
                color: m.autor === 'tenant' ? '#2a1600' : 'var(--cr-text)',
                border: m.autor === 'tenant' ? 'none' : '2px solid var(--cr-border)',
              }}>
                {m.imagenPath && (
                  <a href={`/api/chat/imagen/${m.id}`} target="_blank" rel="noopener noreferrer">
                    <img
                      src={`/api/chat/imagen/${m.id}`}
                      alt="Foto enviada"
                      style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, display: 'block', marginBottom: m.texto ? '0.4rem' : 0 }}
                    />
                  </a>
                )}
                {m.texto && <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.texto}</div>}
                <div style={{ fontSize: '0.68rem', opacity: 0.7, marginTop: '0.2rem', textAlign: 'right' }}>{formatHora(m.fecha)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {archivo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={styles.badge}>📷 {archivo.name}</span>
          <button type="button" className={styles.btnSecondary} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', minHeight: 'auto' }} onClick={() => { setArchivo(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
            ✕ Quitar
          </button>
        </div>
      )}

      {/* Campo de texto en su propia fila (ancho completo, sin competir con
          nada) y los botones debajo repartiendo el ancho a la mitad cada
          uno (flex:1 con flex-basis 0 en vez de ancho fijo + texto) — así
          nunca se pueden desbordar ni recortar entre sí, ni siquiera si el
          tamaño de letra del sistema del celular viene más grande de lo
          normal (eso fue justo lo que pasó: con 3 elementos peleando el
          mismo renglón, el texto más grande de los botones le comía todo
          el espacio al campo de escritura). */}
      <input
        type="text"
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !enviando) enviar(); }}
        placeholder="Escribí tu mensaje…"
        className={styles.input}
        disabled={enviando}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={e => setArchivo(e.target.files?.[0] ?? null)}
        style={{ display: 'none' }}
      />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          className={styles.btnSecondary}
          style={{ flex: 1, minWidth: 0, minHeight: 'auto' }}
          disabled={enviando}
          onClick={() => fileInputRef.current?.click()}
        >
          Foto
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          style={{ flex: 1, minWidth: 0, minHeight: 'auto' }}
          disabled={enviando || (!texto.trim() && !archivo)}
          onClick={enviar}
        >
          {enviando ? '...' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}
