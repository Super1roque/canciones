'use client';
import { useRef, useState } from 'react';

export default function AudioPlayer({ id, fileName }: { id: string; fileName: string }) {
  const audioRef            = useRef<HTMLAudioElement>(null);
  const blobUrlRef          = useRef<string>('');
  const [playing,  setPlaying]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [ended,    setEnded]    = useState(false);
  const [errored,  setErrored]  = useState(false);

  async function handlePlay() {
    const a = audioRef.current;
    if (!a) return;

    // Already loaded — just toggle
    if (blobUrlRef.current) {
      if (a.paused) { a.play(); setPlaying(true); }
      else          { a.pause(); setPlaying(false); }
      return;
    }

    // First tap: fetch full audio as blob, assign to element
    setLoading(true);
    try {
      const res = await fetch(`/api/audio/${id}`);
      if (!res.ok) { setErrored(true); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      a.src = url;
      await a.play();
      setPlaying(true);
    } catch {
      setErrored(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, sans-serif', padding: '1.5rem' }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎵</div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.35rem' }}>Audio compartido</h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', marginBottom: '2.5rem' }}>{fileName}</p>

        {!ended && !errored && (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: '2.5rem 2rem', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', marginBottom: '2rem' }}>
              ⚠️ Solo puede escucharse <strong style={{ color: '#f97316' }}>una vez</strong>
            </p>

            {/* Big play/pause button */}
            <button
              onClick={handlePlay}
              disabled={loading}
              style={{
                width: 88, height: 88, borderRadius: '50%',
                background: loading ? 'rgba(255,255,255,0.06)' : playing ? 'rgba(249,115,22,0.15)' : '#f97316',
                border: playing ? '2px solid #f97316' : 'none',
                cursor: loading ? 'wait' : 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
                boxShadow: playing || loading ? 'none' : '0 0 32px rgba(249,115,22,0.4)',
              }}
            >
              {loading
                ? <span style={{ fontSize: '1.5rem' }}>⏳</span>
                : playing
                  ? <span style={{ fontSize: '2rem', color: '#f97316' }}>⏸</span>
                  : <span style={{ fontSize: '2rem', color: '#fff', marginLeft: 4 }}>▶</span>
              }
            </button>

            {loading && (
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', marginTop: '1rem' }}>
                Cargando audio...
              </p>
            )}

            <audio
              ref={audioRef}
              onEnded={() => { setPlaying(false); setEnded(true); }}
              onError={() => { setPlaying(false); setErrored(true); }}
            />
          </div>
        )}

        {ended && <PaymentCTA />}
        {errored && <ErrorCTA />}
      </div>
    </div>
  );
}

function PaymentCTA() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ background: 'rgba(78,201,160,0.06)', borderRadius: 16, padding: '2.5rem', border: '1px solid rgba(78,201,160,0.25)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✓</div>
        <p style={{ color: 'rgba(78,201,160,0.9)', fontWeight: 600 }}>Audio escuchado</p>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', marginTop: '0.5rem' }}>Este enlace ya no es válido.</p>
      </div>
      <PaymentInfo />
    </div>
  );
}

function ErrorCTA() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ background: 'rgba(239,68,68,0.06)', borderRadius: 16, padding: '2.5rem', border: '1px solid rgba(239,68,68,0.25)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔒</div>
        <p style={{ color: 'rgba(239,68,68,0.9)', fontWeight: 600 }}>Este audio ya fue escuchado</p>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', marginTop: '0.5rem' }}>El enlace ya no es válido.</p>
      </div>
      <PaymentInfo />
    </div>
  );
}

function PaymentInfo() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1030, #0c0c18)',
      borderRadius: 16, padding: '2rem 1.5rem',
      border: '2px solid #f97316',
      boxShadow: '0 0 24px rgba(249,115,22,0.2)',
    }}>
      <p style={{ fontSize: '1rem', fontWeight: 800, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.4, marginBottom: '1.25rem' }}>
        🎵 Para obtener esta canción en audio y video haga el depósito respectivo de:
      </p>
      <div style={{ background: 'rgba(249,115,22,0.12)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem', border: '1px solid rgba(249,115,22,0.3)' }}>
        <p style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff' }}>500 Lempiras</p>
        <p style={{ fontSize: '1rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>ó  20 USD americanos</p>
      </div>
      <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>
        A la siguiente cuenta:
      </p>
      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '1rem 1.25rem', border: '1px solid rgba(255,255,255,0.12)' }}>
        <p style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginBottom: '0.3rem' }}>🏦 Banco Atlántida</p>
        <p style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f97316', letterSpacing: '0.1em', fontFamily: 'monospace' }}>14720926485</p>
      </div>
    </div>
  );
}
