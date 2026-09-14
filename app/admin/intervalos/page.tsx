'use client';
import { useState, useEffect } from 'react';

type Phase = 'idle' | 'generating' | 'done' | 'error';

function fmtSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function IntervalosPage() {
  const [file,      setFile]      = useState<File | null>(null);
  const [phase,     setPhase]     = useState<Phase>('idle');
  const [error,     setError]     = useState('');
  const [dragging,  setDragging]  = useState(false);
  const [resultUrl, setResultUrl] = useState('');

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  function handleFile(f: File) {
    if (!f.type.startsWith('audio/')) { setError('Solo archivos de audio'); return; }
    if (f.size > 20 * 1024 * 1024)   { setError('El archivo supera 20 MB'); return; }
    setError(''); setFile(f); setResultUrl(''); setPhase('idle');
  }

  async function generar() {
    if (!file) return;
    setPhase('generating'); setError('');

    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch('/api/intervalos', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al generar el audio');
      }

      const blob = await res.blob();
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultUrl(URL.createObjectURL(blob));
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar');
      setPhase('error');
    }
  }

  const busy = phase === 'generating';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <header className="header">
        <div className="header-inner">
          <div className="logo"><span className="logo-icon">🎵</span><span className="logo-text">Canciones</span></div>
          <a href="/" className="nav-btn">← Volver</a>
        </div>
      </header>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.3rem' }}>⏸️ Intervalos</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.75rem' }}>
          Sube un audio y le aplica un gate tipo tremolo de onda cuadrada: silencios abruptos de 0.5s a intervalos aleatorios (1.5s, 2s o 5s) a lo largo de todo el audio, sin cambiar su duración
        </p>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => document.getElementById('int-file')?.click()}
          style={{
            border: `2px dashed ${dragging ? '#f97316' : file ? 'var(--success)' : 'var(--border)'}`,
            borderRadius: 14, padding: '2.5rem 2rem', textAlign: 'center', cursor: 'pointer',
            background: dragging ? 'rgba(249,115,22,0.06)' : file ? 'rgba(78,201,160,0.04)' : 'var(--surface)',
            transition: 'all 0.2s', marginBottom: '1.5rem',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{file ? '🎵' : '📁'}</div>
          {file ? (
            <>
              <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.2rem' }}>{file.name}</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{fmtSize(file.size)}</p>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.3rem' }}>Arrastra un audio o haz clic</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>MP3 · WAV · M4A — máximo 20 MB</p>
            </>
          )}
          <input id="int-file" type="file" accept="audio/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
        </div>

        {error && <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>⚠️ {error}</p>}

        {phase === 'done' && (
          <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--success)' }}>✓ Listo</p>
        )}

        <button className="kk-btn primary" onClick={generar} disabled={!file || busy}
          style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginBottom: '0.75rem',
            opacity: (!file || busy) ? 0.5 : 1 }}>
          {busy ? '⏳ Generando...' : '⏸️ Generar con intervalos'}
        </button>

        {resultUrl && (
          <div style={{ marginBottom: '0.75rem' }}>
            <audio controls src={resultUrl} style={{ width: '100%', marginBottom: '0.5rem' }} />
            <a href={resultUrl} download={`${file?.name.replace(/\.[^.]+$/, '') ?? 'audio'}_intervalos.ogg`}
              className="kk-btn primary"
              style={{ display: 'block', textAlign: 'center', width: '100%', padding: '0.7rem', fontSize: '0.9rem',
                background: 'rgba(249,115,22,0.12)', border: '1px solid #f97316', color: '#f97316', borderRadius: 10,
                textDecoration: 'none' }}>
              ⬇ Descargar MP3
            </a>
          </div>
        )}

        {file && (
          <button onClick={() => { setPhase('idle'); setFile(null); setResultUrl(''); }}
            style={{ width: '100%', padding: '0.5rem', fontSize: '0.82rem', cursor: 'pointer',
              border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', borderRadius: 8 }}>
            Cargar otro archivo
          </button>
        )}

        <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.65rem 1rem',
          background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', lineHeight: 1.8 }}>
          💡 Cada vez que generás, los cortes caen en lugares distintos — el patrón de intervalos es aleatorio
        </div>
      </div>
    </div>
  );
}
