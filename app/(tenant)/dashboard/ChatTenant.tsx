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
    if (document.visibilityState !== 'visible') return;
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
  // mensaje del admin aparezca sin recargar la página.
  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 15000);
    document.addEventListener('visibilitychange', cargar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', cargar);
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
    <div className={styles.panel} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <h2 className={styles.heroTitle} style={{ fontSize: '1.1rem', margin: 0 }}>💬 Soporte</h2>
      <p className={styles.textMuted} style={{ fontSize: '0.82rem', margin: 0 }}>
        Escribinos tu consulta o mandá una foto (por ejemplo, el comprobante de un depósito).
      </p>

      <div
        ref={listaRef}
        style={{
          display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 320, overflowY: 'auto',
          background: 'var(--cr-surface-2)', border: '2px solid var(--cr-border)', borderRadius: 10, padding: '0.75rem',
        }}
      >
        {!cargado ? (
          <p className={styles.textMuted} style={{ margin: 0, fontSize: '0.82rem' }}>Cargando…</p>
        ) : mensajes.length === 0 ? (
          <p className={styles.textMuted} style={{ margin: 0, fontSize: '0.82rem' }}>Todavía no escribiste nada por acá.</p>
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

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
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
        <button
          type="button"
          className={styles.btnSecondary}
          style={{ padding: '0.85rem', minHeight: 'auto', flexShrink: 0 }}
          disabled={enviando}
          onClick={() => fileInputRef.current?.click()}
          title="Adjuntar foto"
        >
          📷
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          style={{ padding: '0.85rem 1.1rem', minHeight: 'auto', flexShrink: 0 }}
          disabled={enviando || (!texto.trim() && !archivo)}
          onClick={enviar}
        >
          {enviando ? '...' : '➤'}
        </button>
      </div>
    </div>
  );
}
