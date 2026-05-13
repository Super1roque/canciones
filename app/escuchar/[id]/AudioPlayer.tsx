'use client';
import { useRef, useState } from 'react';

export default function AudioPlayer({ id, fileName }: { id: string; fileName: string }) {
  const audioRef             = useRef<HTMLAudioElement>(null);
  const [playing,  setPlaying]  = useState(false);
  const [ended,    setEnded]    = useState(false);
  const [errored,  setErrored]  = useState(false);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); }
    else          { a.pause(); setPlaying(false); }
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
              onClick={toggle}
              style={{
                width: 88, height: 88, borderRadius: '50%',
                background: playing ? 'rgba(249,115,22,0.15)' : '#f97316',
                border: playing ? '2px solid #f97316' : 'none',
                cursor: 'pointer', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s', boxShadow: playing ? 'none' : '0 0 32px rgba(249,115,22,0.4)',
              }}
            >
              {playing
                ? <span style={{ fontSize: '2rem', color: '#f97316' }}>⏸</span>
                : <span style={{ fontSize: '2rem', color: '#fff', marginLeft: 4 }}>▶</span>
              }
            </button>

            <audio
              ref={audioRef}
              src={`/api/audio/${id}`}
              preload="none"
              onEnded={() => { setPlaying(false); setEnded(true); }}
              onError={() => { setPlaying(false); setErrored(true); }}
            />
          </div>
        )}

        {ended && (
          <div style={{ background: 'rgba(78,201,160,0.06)', borderRadius: 16, padding: '2.5rem', border: '1px solid rgba(78,201,160,0.25)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✓</div>
            <p style={{ color: 'rgba(78,201,160,0.9)', fontWeight: 600 }}>Audio escuchado</p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', marginTop: '0.5rem' }}>Este enlace ya no es válido.</p>
          </div>
        )}

        {errored && (
          <div style={{ background: 'rgba(239,68,68,0.06)', borderRadius: 16, padding: '2.5rem', border: '1px solid rgba(239,68,68,0.25)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔒</div>
            <p style={{ color: 'rgba(239,68,68,0.9)', fontWeight: 600 }}>Este audio ya fue escuchado</p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', marginTop: '0.5rem' }}>El enlace ya no es válido.</p>
          </div>
        )}
      </div>
    </div>
  );
}
