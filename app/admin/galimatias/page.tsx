'use client';
import { useState, useRef, useEffect } from 'react';

type NoteEvent = {
  startTimeSeconds: number;
  durationSeconds:  number;
  pitchMidi:        number;
  amplitude:        number;
};

type Phase = 'idle' | 'loading_model' | 'analyzing' | 'ready' | 'generating' | 'done' | 'error';

function fmtSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function GalimatiasPage() {
  const [file,       setFile]       = useState<File | null>(null);
  const [phase,      setPhase]      = useState<Phase>('idle');
  const [progress,   setProgress]   = useState(0);
  const [notes,      setNotes]      = useState<NoteEvent[]>([]);
  const [duration,   setDuration]   = useState(0);
  const [error,      setError]      = useState('');
  const [dragging,   setDragging]   = useState(false);
  const [resultUrl,  setResultUrl]  = useState('');
  const [modo,       setModo]       = useState<'voz' | 'silaba' | 'beep'>('silaba');

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => { workerRef.current?.terminate(); }, []);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  function handleFile(f: File) {
    if (!f.type.startsWith('audio/')) { setError('Solo archivos de audio'); return; }
    if (f.size > 10 * 1024 * 1024)   { setError('El archivo supera 10 MB'); return; }
    setError(''); setFile(f); setNotes([]); setResultUrl(''); setPhase('idle');
  }

  async function analyze() {
    if (!file) return;
    setPhase('loading_model'); setProgress(0); setError('');

    try {
      const decodeCtx = new AudioContext({ sampleRate: 22050 });
      const audioBuf  = await decodeCtx.decodeAudioData(await file.arrayBuffer());
      await decodeCtx.close();
      setDuration(audioBuf.duration);

      let mono: Float32Array;
      if (audioBuf.numberOfChannels === 1) {
        mono = audioBuf.getChannelData(0).slice();
      } else {
        const ch0 = audioBuf.getChannelData(0), ch1 = audioBuf.getChannelData(1);
        mono = new Float32Array(ch0.length);
        const CHUNK = 50_000;
        for (let i = 0; i < ch0.length; i += CHUNK) {
          const end = Math.min(ch0.length, i + CHUNK);
          for (let j = i; j < end; j++) mono[j] = (ch0[j] + ch1[j]) / 2;
          await new Promise(r => setTimeout(r, 0));
        }
      }

      setPhase('analyzing');
      workerRef.current?.terminate();

      // Reusa el mismo worker de basic-pitch que /instrumento
      const worker = new Worker(new URL('../instrumento/worker.ts', import.meta.url));
      workerRef.current = worker;
      const modelUrl = `${window.location.origin}/basic-pitch-model/model.json`;

      worker.onmessage = (ev: MessageEvent) => {
        const msg = ev.data;
        if (msg.type === 'progress') {
          setProgress(msg.value);
        } else if (msg.type === 'done') {
          setNotes(msg.notes);
          setPhase('ready');
          worker.terminate(); workerRef.current = null;
        } else if (msg.type === 'error') {
          setError(msg.message);
          setPhase('error');
          worker.terminate(); workerRef.current = null;
        }
      };
      worker.onerror = (ev: ErrorEvent) => {
        setError(ev.message || 'Error en el análisis');
        setPhase('error');
        worker.terminate(); workerRef.current = null;
      };

      worker.postMessage({ mono, modelUrl }, [mono.buffer]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al analizar');
      setPhase('error');
    }
  }

  async function generar() {
    if (!file || notes.length === 0) return;
    setPhase('generating'); setProgress(0); setError('');

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('notes', JSON.stringify(notes));
      fd.append('duration', String(duration));
      fd.append('modo', modo);

      const res = await fetch('/api/galimatias', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al generar el galimatías');
      }

      const blob = await res.blob();
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultUrl(URL.createObjectURL(blob));
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar');
      setPhase('ready');
    }
  }

  const busy = phase === 'loading_model' || phase === 'analyzing' || phase === 'generating';

  const statusMsg =
    phase === 'loading_model' ? 'Cargando modelo IA (puede tardar 1-2 min en local)...' :
    phase === 'analyzing'     ? `Analizando melodía... ${progress}%` :
    phase === 'generating'    ? 'Generando galimatías cantado (transcribiendo, inventando palabras y sintetizando voz)...' :
    phase === 'ready'         ? `✓ ${notes.length} notas detectadas` :
    phase === 'done'          ? '✓ Listo' : '';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <header className="header">
        <div className="header-inner">
          <div className="logo"><span className="logo-icon">🎵</span><span className="logo-text">Canciones</span></div>
          <a href="/admin" className="nav-btn">← Volver</a>
        </div>
      </header>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.3rem' }}>🗣️ Galimatías Cantado</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.75rem' }}>
          Convierte la letra de un audio a capella en palabras sin sentido, conservando el ritmo y la melodía original
        </p>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => document.getElementById('gal-file')?.click()}
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
              <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.3rem' }}>Arrastra un audio a capella o haz clic</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>MP3 · WAV · M4A — máximo 10 MB</p>
            </>
          )}
          <input id="gal-file" type="file" accept="audio/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
        </div>

        {error && <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>⚠️ {error}</p>}

        {statusMsg && (
          <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem',
            color: (phase === 'ready' || phase === 'done') ? 'var(--success)' : 'var(--text-muted)' }}>
            {statusMsg}
          </p>
        )}
        {(phase === 'analyzing') && (
          <div style={{ background: 'var(--border)', borderRadius: 4, height: 6, marginBottom: '1rem', overflow: 'hidden' }}>
            <div style={{ background: '#f97316', height: '100%', width: `${progress}%`, transition: 'width 0.2s', borderRadius: 4 }} />
          </div>
        )}

        {phase !== 'ready' && phase !== 'done' && (
          <button className="kk-btn primary" onClick={analyze} disabled={!file || busy}
            style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginBottom: '0.75rem',
              opacity: (!file || busy) ? 0.5 : 1 }}>
            {busy ? '⏳ Procesando...' : '🎵 Analizar melodía'}
          </button>
        )}

        {(phase === 'ready' || phase === 'generating' || phase === 'done') && (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {(['voz', 'silaba', 'beep'] as const).map(m => (
                <button key={m} onClick={() => setModo(m)} disabled={busy}
                  style={{
                    flex: 1, padding: '0.5rem', borderRadius: 8, fontSize: '0.82rem', cursor: 'pointer',
                    border: modo === m ? '1px solid #f97316' : '1px solid var(--border)',
                    background: modo === m ? 'rgba(249,115,22,0.15)' : 'var(--surface)',
                    color: modo === m ? '#f97316' : 'var(--text-muted)',
                  }}>
                  {m === 'voz' ? '🗣️ Palabras' : m === 'silaba' ? '🎶 Sílabas' : '🎵 Tonos'}
                </button>
              ))}
            </div>

            <button className="kk-btn primary" onClick={generar} disabled={busy}
              style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginBottom: '0.75rem',
                opacity: busy ? 0.5 : 1 }}>
              {phase === 'generating' ? '⏳ Generando...' : '🗣️ Generar galimatías cantado'}
            </button>

            {resultUrl && (
              <div style={{ marginBottom: '0.75rem' }}>
                <audio controls src={resultUrl} style={{ width: '100%', marginBottom: '0.5rem' }} />
                <a href={resultUrl} download={`${file?.name.replace(/\.[^.]+$/, '') ?? 'galimatias'}_galimatias.mp3`}
                  className="kk-btn primary"
                  style={{ display: 'block', textAlign: 'center', width: '100%', padding: '0.7rem', fontSize: '0.9rem',
                    background: 'rgba(249,115,22,0.12)', border: '1px solid #f97316', color: '#f97316', borderRadius: 10,
                    textDecoration: 'none' }}>
                  ⬇ Descargar MP3
                </a>
              </div>
            )}

            <button onClick={() => { setPhase('idle'); setNotes([]); setFile(null); setResultUrl(''); }}
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.82rem', cursor: 'pointer',
                border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', borderRadius: 8 }}>
              Cargar otro archivo
            </button>
          </>
        )}

        <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.65rem 1rem',
          background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', lineHeight: 1.8 }}>
          💡 Funciona mejor con <strong>voz sola</strong> sin música de fondo · La melodía se analiza en tu dispositivo; el audio se sube al servidor solo para generar la voz final
        </div>
      </div>
    </div>
  );
}
