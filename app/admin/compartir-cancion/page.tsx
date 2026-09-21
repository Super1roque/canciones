'use client';
import { useState, useEffect, useCallback } from 'react';

type CancionCompartida = {
  id: string;
  titulo: string;
  fecha: string;
  reproducciones: number;
};

function fmtSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function CompartirCancionPage() {
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState('');
  const [uploading, setUploading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  // Para medir viralización: cuántas veces se reprodujo cada canción
  // compartida, no solo la más reciente — así se puede comparar entre sí.
  const [canciones, setCanciones] = useState<CancionCompartida[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargarCanciones = useCallback(() => {
    return fetch('/api/admin/canciones-compartidas')
      .then(res => res.json())
      .then(data => setCanciones(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    cargarCanciones().finally(() => setCargando(false));
  }, [cargarCanciones]);

  function handleFile(f: File) {
    if (!f.type.startsWith('audio/')) { setError('Solo se aceptan archivos de audio'); return; }
    if (f.size > 20 * 1024 * 1024) { setError('El archivo supera 20 MB'); return; }
    setError(''); setFile(f); setShareUrl('');
  }

  async function upload() {
    if (!file) return;
    if (!titulo.trim()) { setError('Ponele un título a la canción'); return; }
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('titulo', titulo.trim());
      const res = await fetch('/api/canciones-compartidas/upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || `Error al subir (${res.status})`); return; }
      setShareUrl(`${window.location.origin}/cancion/${data.id}`);
      cargarCanciones();
    } catch {
      setError('Error de conexión');
    } finally {
      setUploading(false);
    }
  }

  function copy() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <header className="header">
        <div className="header-inner">
          <div className="logo"><span className="logo-icon">🎵</span><span className="logo-text">Canciones</span></div>
          <a href="/admin" className="nav-btn">← Volver</a>
        </div>
      </header>

      <div style={{ maxWidth: 580, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.3rem' }}>🎤 Compartir Canción</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.75rem' }}>
          Sube una canción generada y te doy un link para compartir — se puede escuchar las veces que sea, no se descarga, y al terminar invita a registrarse en corridos.online
        </p>

        {!shareUrl ? (
          <>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
              Título de la canción
            </label>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ej: Corrido para Marco — Las Heladas"
              className="input"
              style={{ width: '100%', marginBottom: '1.25rem', boxSizing: 'border-box' }}
            />

            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => document.getElementById('cc-file')?.click()}
              style={{
                border: `2px dashed ${dragging ? '#f97316' : file ? 'var(--success)' : 'var(--border)'}`,
                borderRadius: 14, padding: '3.5rem 2rem', textAlign: 'center', cursor: 'pointer',
                background: dragging ? 'rgba(249,115,22,0.06)' : file ? 'rgba(78,201,160,0.04)' : 'var(--surface)',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>{file ? '🎵' : '📁'}</div>
              {file ? (
                <>
                  <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>{file.name}</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{fmtSize(file.size)}</p>
                </>
              ) : (
                <>
                  <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.4rem' }}>
                    Arrastra el mp3 o hacé clic
                  </p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>MP3 · WAV · M4A — máximo 20 MB</p>
                </>
              )}
              <input id="cc-file" type="file" accept="audio/*" style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            </div>

            {error && (
              <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginTop: '0.75rem' }}>⚠️ {error}</p>
            )}

            {file && (
              <button
                className="kk-btn primary"
                onClick={upload}
                disabled={uploading}
                style={{ marginTop: '1.25rem', width: '100%', opacity: uploading ? 0.6 : 1, fontSize: '1rem', padding: '0.75rem' }}
              >
                {uploading ? '⏳ Subiendo y preparando la letra (puede tardar hasta 2 min)...' : '🔗 Generar enlace'}
              </button>
            )}
          </>
        ) : (
          <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '2rem', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '0.75rem' }}>✅</div>
            <p style={{ fontWeight: 700, textAlign: 'center', fontSize: '1.05rem', marginBottom: '0.35rem' }}>¡Enlace listo!</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', marginBottom: '1.5rem' }}>
              Se puede escuchar sin límite — no se descarga
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                readOnly value={shareUrl}
                onClick={e => (e.target as HTMLInputElement).select()}
                style={{
                  flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '0.6rem 0.75rem', color: 'var(--text)',
                  fontSize: '0.78rem', fontFamily: 'monospace',
                }}
              />
              <button className="kk-btn primary" onClick={copy} style={{ whiteSpace: 'nowrap' }}>
                {copied ? '✅ Copiado' : '📋 Copiar'}
              </button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', marginTop: '1rem' }}>
              🎤 Ya se preparó la letra sincronizada — el link está listo para compartir.
            </p>

            <button
              className="kk-mode-btn"
              onClick={() => { setFile(null); setTitulo(''); setShareUrl(''); }}
              style={{ marginTop: '1.25rem', width: '100%' }}
            >
              + Compartir otra canción
            </button>
          </div>
        )}

        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '2.5rem 0 0.75rem' }}>📊 Reproducciones</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1rem' }}>
          Cuántas veces se abrió cada link — cada apertura cuenta una sola vez por visita, no importa si se pausa o se repite.
        </p>
        {cargando ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Cargando…</p>
        ) : canciones.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Todavía no se compartió ninguna canción.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {canciones.map(c => (
              <div
                key={c.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem',
                  border: '1px solid var(--border)', borderRadius: 10, padding: '0.65rem 0.9rem',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.titulo}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{formatFecha(c.fecha)}</div>
                </div>
                <div className="badge" style={{ whiteSpace: 'nowrap' }}>
                  ▶️ {c.reproducciones}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
