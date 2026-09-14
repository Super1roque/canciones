'use client';
import { useState } from 'react';

function fmtSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function CompartirPage() {
  const [file,      setFile]      = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [shareUrl,  setShareUrl]  = useState('');
  const [copied,    setCopied]    = useState(false);
  const [dragging,  setDragging]  = useState(false);
  const [error,     setError]     = useState('');

  function handleFile(f: File) {
    if (!f.type.startsWith('audio/')) { setError('Solo se aceptan archivos de audio'); return; }
    if (f.size > 4 * 1024 * 1024)    { setError('El archivo supera 4 MB. Usa ✂️ Recortar para reducirlo.'); return; }
    setError(''); setFile(f); setShareUrl('');
  }

  async function upload() {
    if (!file) return;
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res  = await fetch('/api/audio/upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || `Error al subir (${res.status})`); return; }
      setShareUrl(`${window.location.origin}/escuchar/${data.id}`);
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
          <a href="/" className="nav-btn">← Volver</a>
        </div>
      </header>

      <div style={{ maxWidth: 580, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.3rem' }}>🔗 Compartir Audio</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.75rem' }}>
          Genera un enlace único para que alguien escuche el audio <strong>una sola vez</strong>
        </p>

        {!shareUrl ? (
          <>
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => document.getElementById('sh-file')?.click()}
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
                    Arrastra un archivo de audio o haz clic
                  </p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>MP3 · WAV · M4A — máximo 4 MB</p>
                </>
              )}
              <input id="sh-file" type="file" accept="audio/*" style={{ display: 'none' }}
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
                {uploading ? '⏳ Subiendo...' : '🔗 Generar enlace único'}
              </button>
            )}
          </>
        ) : (
          /* Share result */
          <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '2rem', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '0.75rem' }}>✅</div>
            <p style={{ fontWeight: 700, textAlign: 'center', fontSize: '1.05rem', marginBottom: '0.35rem' }}>¡Enlace listo!</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', marginBottom: '1.5rem' }}>
              Solo funcionará <strong>una vez</strong> — después queda inválido
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

            <button
              className="kk-mode-btn"
              onClick={() => { setFile(null); setShareUrl(''); }}
              style={{ marginTop: '1.25rem', width: '100%' }}
            >
              + Compartir otro audio
            </button>
          </div>
        )}

        <div style={{
          marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)',
          padding: '0.65rem 1rem', background: 'var(--surface)',
          borderRadius: 8, border: '1px solid var(--border)', lineHeight: 1.7,
        }}>
          💡 El enlace deja de funcionar después de escucharse · El archivo se elimina automáticamente · Máximo 4 MB · Usa ✂️ Recortar para archivos más grandes
        </div>
      </div>
    </div>
  );
}
