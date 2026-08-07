'use client';
import { useState, useEffect } from 'react';

type Phase = 'idle' | 'generating' | 'done' | 'error';

function fmtSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type Modo = 'voz' | 'tono';

export default function CambiaLetraPage() {
  const [file,      setFile]      = useState<File | null>(null);
  const [texto,     setTexto]     = useState('');
  const [modo,      setModo]      = useState<Modo>('voz');
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
    if (!file || (modo === 'voz' && !texto.trim())) return;
    setPhase('generating'); setError('');

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('modo', modo);
      if (modo === 'voz') fd.append('texto', texto);

      const res = await fetch('/api/cambialetra', { method: 'POST', body: fd });
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
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.3rem' }}>📝 Cambia Letra</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1rem' }}>
          Sube un audio a capella. Elegí si querés reemplazar la letra por una nueva (voz sintetizada) o tararear el tono original con un sonido puro
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {([
            { id: 'voz' as const, label: '🗣️ Letra nueva' },
            { id: 'tono' as const, label: '🎵 Tarareo del tono' },
          ]).map(m => (
            <button key={m.id} onClick={() => setModo(m.id)} disabled={busy}
              style={{
                flex: 1, padding: '0.6rem', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer',
                border: modo === m.id ? '1px solid #f97316' : '1px solid var(--border)',
                background: modo === m.id ? 'rgba(249,115,22,0.15)' : 'var(--surface)',
                color: modo === m.id ? '#f97316' : 'var(--text-muted)',
              }}>
              {m.label}
            </button>
          ))}
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => document.getElementById('cl-file')?.click()}
          style={{
            border: `2px dashed ${dragging ? '#f97316' : file ? 'var(--success)' : 'var(--border)'}`,
            borderRadius: 14, padding: '2.5rem 2rem', textAlign: 'center', cursor: 'pointer',
            background: dragging ? 'rgba(249,115,22,0.06)' : file ? 'rgba(78,201,160,0.04)' : 'var(--surface)',
            transition: 'all 0.2s', marginBottom: '1rem',
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
              <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.3rem' }}>Arrastra un audio a capella o haz clic</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>MP3 · WAV · M4A — máximo 20 MB</p>
            </>
          )}
          <input id="cl-file" type="file" accept="audio/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
        </div>

        {modo === 'voz' && (
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Escribe acá la letra nueva completa (no hace falta que tenga la misma cantidad de palabras que el original)"
            rows={5}
            disabled={busy}
            style={{
              width: '100%', padding: '0.85rem', borderRadius: 10, marginBottom: '1rem',
              border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
              fontFamily: 'inherit', fontSize: '0.92rem', resize: 'vertical',
            }}
          />
        )}

        {error && <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>⚠️ {error}</p>}

        {phase === 'done' && (
          <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--success)' }}>✓ Listo</p>
        )}

        <button className="kk-btn primary" onClick={generar} disabled={!file || (modo === 'voz' && !texto.trim()) || busy}
          style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginBottom: '0.75rem',
            opacity: (!file || (modo === 'voz' && !texto.trim()) || busy) ? 0.5 : 1 }}>
          {busy
            ? '⏳ Generando...'
            : modo === 'voz' ? '📝 Generar con letra nueva' : '🎵 Generar tarareo'}
        </button>

        {resultUrl && (
          <div style={{ marginBottom: '0.75rem' }}>
            <audio controls src={resultUrl} style={{ width: '100%', marginBottom: '0.5rem' }} />
            <a href={resultUrl} download={`${file?.name.replace(/\.[^.]+$/, '') ?? 'audio'}_cambialetra.mp3`}
              className="kk-btn primary"
              style={{ display: 'block', textAlign: 'center', width: '100%', padding: '0.7rem', fontSize: '0.9rem',
                background: 'rgba(249,115,22,0.12)', border: '1px solid #f97316', color: '#f97316', borderRadius: 10,
                textDecoration: 'none' }}>
              ⬇ Descargar MP3
            </a>
          </div>
        )}

        <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.65rem 1rem',
          background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', lineHeight: 1.8 }}>
          💡 Funciona mejor con <strong>voz sola</strong> sin música de fondo · La letra nueva se reparte automáticamente sobre los tiempos del audio original · Podés pegar anotaciones tipo <code>[Coro]</code> o <code>(spoken)</code> — se ignoran automáticamente, no se cantan
        </div>
      </div>
    </div>
  );
}
