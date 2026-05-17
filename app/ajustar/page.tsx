'use client';
import { useState, useRef } from 'react';

function fmtSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AjustarPage() {
  const [file,       setFile]       = useState<File | null>(null);
  const [pitch,      setPitch]      = useState(0);    // semitones
  const [tempo,      setTempo]      = useState(100);  // percentage
  const [format,     setFormat]     = useState<'mp3' | 'ogg'>('mp3');
  const [noise,      setNoise]      = useState(0); // 0-10
  const [reverb,     setReverb]     = useState(0); // 0-10
  const [processing, setProcessing] = useState(false);
  const [error,      setError]      = useState('');
  const [dragging,   setDragging]   = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const blobUrlRef = useRef('');

  function handleFile(f: File) {
    if (!f.type.startsWith('audio/')) { setError('Solo se aceptan archivos de audio'); return; }
    if (f.size > 4 * 1024 * 1024)    { setError('El archivo supera 4 MB'); return; }
    setError(''); setFile(f);
    // preview original
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = URL.createObjectURL(f);
    if (audioRef.current) audioRef.current.src = blobUrlRef.current;
  }

  async function process() {
    if (!file) return;
    setProcessing(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('pitch', String(pitch));
      fd.append('tempo', String(tempo / 100));
      fd.append('noise',  String(noise));
      fd.append('reverb', String(reverb));
      fd.append('format', format);
      const res  = await fetch('/api/audio/ajustar', { method: 'POST', body: fd });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let msg = ''; try { msg = JSON.parse(text).error; } catch { msg = text.slice(0, 200); }
        setError(msg || `Error ${res.status}`); return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = file.name.replace(/\.[^.]+$/, '') + `_ajustado.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Error de conexión');
    } finally {
      setProcessing(false);
    }
  }

  const tempoLabel = tempo === 100 ? 'Sin cambio' : tempo > 100 ? `+${tempo - 100}% más rápido` : `-${100 - tempo}% más lento`;
  const pitchLabel = pitch === 0 ? 'Sin cambio' : pitch > 0 ? `+${pitch} semitono${pitch !== 1 ? 's' : ''} más agudo` : `${pitch} semitono${pitch !== -1 ? 's' : ''} más grave`;
  const hasChanges = pitch !== 0 || tempo !== 100 || noise > 0 || reverb > 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <header className="header">
        <div className="header-inner">
          <div className="logo"><span className="logo-icon">🎵</span><span className="logo-text">Canciones</span></div>
          <a href="/" className="nav-btn">← Volver</a>
        </div>
      </header>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.3rem' }}>🎚️ Ajustar Audio</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.75rem' }}>
          Cambia el tono o la velocidad de una canción sin afectar la otra
        </p>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => document.getElementById('aj-file')?.click()}
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
              <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.3rem' }}>Arrastra un archivo o haz clic</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>MP3 · WAV · M4A — máximo 4 MB</p>
            </>
          )}
          <input id="aj-file" type="file" accept="audio/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
        </div>

        {/* Player original */}
        {file && (
          <audio ref={audioRef} controls style={{ width: '100%', marginBottom: '1.5rem', borderRadius: 8 }} />
        )}

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>

          {/* Pitch */}
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '1.25rem', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>🎵 Tono (Pitch)</span>
              <span style={{ fontSize: '0.85rem', color: pitch === 0 ? 'var(--text-muted)' : '#f97316', fontWeight: 600 }}>{pitchLabel}</span>
            </div>
            <input type="range" min={-4} max={4} step={1} value={pitch}
              onChange={e => setPitch(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#f97316' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              <span>−4 semitonos</span><span>0</span><span>+4 semitonos</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              {[-4,-3,-2,-1,0,1,2,3,4].map(v => (
                <button key={v} onClick={() => setPitch(v)}
                  style={{ padding: '0.25rem 0.6rem', borderRadius: 6, fontSize: '0.78rem', cursor: 'pointer',
                    border: pitch === v ? '1px solid #f97316' : '1px solid var(--border)',
                    background: pitch === v ? 'rgba(249,115,22,0.15)' : 'var(--surface-2)',
                    color: pitch === v ? '#f97316' : 'var(--text-muted)',
                  }}>
                  {v > 0 ? `+${v}` : v}
                </button>
              ))}
            </div>
          </div>

          {/* Tempo */}
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '1.25rem', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>⏱ Velocidad (Tempo)</span>
              <span style={{ fontSize: '0.85rem', color: tempo === 100 ? 'var(--text-muted)' : '#f97316', fontWeight: 600 }}>{tempoLabel}</span>
            </div>
            <input type="range" min={80} max={120} step={1} value={tempo}
              onChange={e => setTempo(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#f97316' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              <span>−20%</span><span>Normal</span><span>+20%</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              {[80,85,90,95,100,105,110,115,120].map(v => (
                <button key={v} onClick={() => setTempo(v)}
                  style={{ padding: '0.25rem 0.6rem', borderRadius: 6, fontSize: '0.78rem', cursor: 'pointer',
                    border: tempo === v ? '1px solid #f97316' : '1px solid var(--border)',
                    background: tempo === v ? 'rgba(249,115,22,0.15)' : 'var(--surface-2)',
                    color: tempo === v ? '#f97316' : 'var(--text-muted)',
                  }}>
                  {v}%
                </button>
              ))}
            </div>
          </div>

          {/* Ruido blanco */}
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '1.25rem', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>〰️ Ruido blanco de fondo</span>
              <span style={{ fontSize: '0.85rem', color: noise === 0 ? 'var(--text-muted)' : '#f97316', fontWeight: 600 }}>
                {noise === 0 ? 'Desactivado' : `Nivel ${noise}`}
              </span>
            </div>
            <input type="range" min={0} max={10} step={1} value={noise}
              onChange={e => setNoise(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#f97316' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              <span>Sin ruido</span><span>Sutil</span><span>Fuerte</span>
            </div>
          </div>

          {/* Reverb */}
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '1.25rem', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>🏛️ Reverb</span>
              <span style={{ fontSize: '0.85rem', color: reverb === 0 ? 'var(--text-muted)' : '#f97316', fontWeight: 600 }}>
                {reverb === 0 ? 'Desactivado' : reverb <= 3 ? `Nivel ${reverb} — Sala pequeña` : reverb <= 6 ? `Nivel ${reverb} — Salón` : `Nivel ${reverb} — Catedral`}
              </span>
            </div>
            <input type="range" min={0} max={10} step={1} value={reverb}
              onChange={e => setReverb(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#f97316' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              <span>Sin reverb</span><span>Sala</span><span>Catedral</span>
            </div>
          </div>
        </div>

        {/* Formato */}
        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}>
          {(['mp3', 'ogg'] as const).map(f => (
            <button key={f} onClick={() => setFormat(f)}
              style={{ flex: 1, padding: '0.55rem', borderRadius: 8, fontSize: '0.88rem', cursor: 'pointer', fontWeight: 600,
                border: format === f ? '1px solid #f97316' : '1px solid var(--border)',
                background: format === f ? 'rgba(249,115,22,0.15)' : 'var(--surface)',
                color: format === f ? '#f97316' : 'var(--text-muted)',
              }}>
              .{f.toUpperCase()}
            </button>
          ))}
        </div>

        {error && <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>⚠️ {error}</p>}

        <button
          className="kk-btn primary"
          onClick={process}
          disabled={!file || !hasChanges || processing}
          style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', opacity: (!file || !hasChanges || processing) ? 0.5 : 1 }}
        >
          {processing ? '⏳ Procesando...' : `⬇ Procesar y descargar .${format.toUpperCase()}`}
        </button>

        {!hasChanges && file && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.6rem' }}>
            Mueve algún slider para activar el procesamiento
          </p>
        )}

        <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.65rem 1rem', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', lineHeight: 1.7 }}>
          💡 El tono y la velocidad se ajustan de forma independiente · Se descarga como <strong>.mp3</strong> a 192 kbps · Máximo 4 MB
        </div>
      </div>
    </div>
  );
}
