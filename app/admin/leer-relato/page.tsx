'use client';
import { useState, useRef, useEffect } from 'react';

type Cue = { start: number; end: number; text: string };
type Fase = 'idle' | 'generando' | 'listo' | 'error';

const VOCES_MASCULINAS = ['javier', 'luciano', 'valerio', 'nestor', 'alvaro', 'sirio', 'aquila'];
const VOCES_FEMENINAS = ['estrella', 'olivia', 'carina', 'diana', 'agustina', 'silvia', 'celeste', 'gloria', 'selena', 'antonia'];

function nombreVoz(id: string) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function base64ToBlob(b64: string, contentType: string): Blob {
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: contentType });
}

export default function LeerRelatoPage() {
  const [texto, setTexto] = useState('');
  const [voz, setVoz] = useState('javier');
  const [fase, setFase] = useState<Fase>('idle');
  const [error, setError] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [nombreDescarga, setNombreDescarga] = useState('lectura.mp3');
  const [cues, setCues] = useState<Cue[]>([]);
  const [indiceActual, setIndiceActual] = useState(-1);

  const audioRef = useRef<HTMLAudioElement>(null);
  const palabraRef = useRef<HTMLSpanElement>(null);
  const cueIndexRef = useRef(0);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  useEffect(() => {
    // Mantiene la palabra actual visible dentro del panel de lectura,
    // como un teleprompter — solo hace scroll dentro del contenedor, no
    // de toda la página.
    palabraRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [indiceActual]);

  async function generar() {
    if (!texto.trim()) return;
    setFase('generando');
    setError('');
    setCues([]);
    setIndiceActual(-1);
    cueIndexRef.current = 0;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl('');

    try {
      const res = await fetch('/api/leer-relato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: texto.trim(), voz }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al generar la lectura'); setFase('error'); return; }

      const blob = base64ToBlob(data.audio, data.contentType || 'audio/mpeg');
      setAudioUrl(URL.createObjectURL(blob));
      setNombreDescarga(`lectura-${voz}.mp3`);
      setCues(data.cues || []);
      setFase('listo');
    } catch {
      setError('Error de conexión con el servidor');
      setFase('error');
    }
  }

  function alAvanzarTiempo() {
    const t = audioRef.current?.currentTime ?? 0;
    if (cues.length === 0) return;
    let i = cueIndexRef.current;
    while (i < cues.length - 1 && cues[i].end < t) i++;
    while (i > 0 && cues[i].start > t) i--;
    cueIndexRef.current = i;
    setIndiceActual(i);
  }

  const busy = fase === 'generando';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <header className="header">
        <div className="header-inner">
          <div className="logo"><span className="logo-icon">🎵</span><span className="logo-text">Canciones</span></div>
          <a href="/admin" className="nav-btn">← Volver</a>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.3rem' }}>📖 Leer Relato</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
          Pegá un texto, elegí una voz, y lo escuchás mientras se resalta la palabra que se va leyendo — como un teleprompter.
        </p>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label htmlFor="voz-select">Voz</label>
          <select
            id="voz-select"
            value={voz}
            onChange={e => setVoz(e.target.value)}
            disabled={busy}
            className="input"
            style={{ width: '100%', boxSizing: 'border-box' }}
          >
            <optgroup label="Voces masculinas">
              {VOCES_MASCULINAS.map(v => <option key={v} value={v}>{nombreVoz(v)}</option>)}
            </optgroup>
            <optgroup label="Voces femeninas">
              {VOCES_FEMENINAS.map(v => <option key={v} value={v}>{nombreVoz(v)}</option>)}
            </optgroup>
          </select>
        </div>

        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Pegá acá el relato o texto que querés escuchar..."
          rows={8}
          disabled={busy}
          className="input"
          style={{ width: '100%', boxSizing: 'border-box', marginBottom: '1rem', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.92rem', padding: '0.85rem' }}
        />

        {error && <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>⚠️ {error}</p>}

        <button
          className="kk-btn primary"
          onClick={generar}
          disabled={!texto.trim() || busy}
          style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginBottom: '1.5rem', opacity: (!texto.trim() || busy) ? 0.5 : 1 }}
        >
          {busy ? '⏳ Generando lectura... (puede tardar según el largo del texto)' : '📖 Generar lectura'}
        </button>

        {audioUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <audio
              ref={audioRef}
              controls
              src={audioUrl}
              onTimeUpdate={alAvanzarTiempo}
              style={{ width: '100%' }}
            />

            <a
              href={audioUrl}
              download={nombreDescarga}
              className="kk-btn primary"
              style={{ textAlign: 'center', textDecoration: 'none', background: 'rgba(249,115,22,0.12)', border: '1px solid #f97316', color: '#f97316', borderRadius: 10, padding: '0.7rem', fontSize: '0.9rem' }}
            >
              ⬇ Descargar MP3
            </a>

            <div
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
                padding: '1.5rem', maxHeight: '50vh', overflowY: 'auto',
                fontSize: '1.15rem', lineHeight: 2,
              }}
            >
              {cues.map((c, i) => (
                <span
                  key={i}
                  ref={i === indiceActual ? palabraRef : null}
                  className={i === indiceActual ? 'palabra-leyendo' : undefined}
                  style={{
                    display: 'inline-block',
                    marginRight: '0.35em',
                    color: i === indiceActual ? '#f2b705' : i < indiceActual ? 'var(--text-muted)' : 'var(--text)',
                    fontWeight: i === indiceActual ? 800 : 400,
                  }}
                >
                  {c.text}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulsoLectura {
          0% { transform: scale(0.7); opacity: 0.6; }
          50% { transform: scale(1.25); }
          100% { transform: scale(1); opacity: 1; }
        }
        .palabra-leyendo { animation: pulsoLectura 0.28s cubic-bezier(.34,1.56,.64,1); }
        @media (prefers-reduced-motion: reduce) {
          .palabra-leyendo { animation: none; }
        }
      `}</style>
    </div>
  );
}
