'use client';
import { useRef, useState } from 'react';

type Cue = { start: number; end: number; text: string };

export default function RelatoPublicoClient({ audioApiUrl, titulo, cues }: { audioApiUrl: string; titulo: string; cues: Cue[] }) {
  const [indiceActual, setIndiceActual] = useState(-1);
  const audioRef = useRef<HTMLAudioElement>(null);
  const palabraRef = useRef<HTMLSpanElement>(null);
  const cueIndexRef = useRef(0);

  function alAvanzarTiempo() {
    const t = audioRef.current?.currentTime ?? 0;
    if (cues.length === 0) return;
    let i = cueIndexRef.current;
    while (i < cues.length - 1 && cues[i].end < t) i++;
    while (i > 0 && cues[i].start > t) i--;
    cueIndexRef.current = i;
    setIndiceActual(i);
    palabraRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div style={{ minHeight: '100vh', background: '#141210', color: '#f2ede6', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', opacity: 0.7 }}>
          <span style={{ fontSize: '1.3rem' }}>📖</span>
          <span style={{ fontSize: '0.85rem', letterSpacing: '0.02em' }}>corridos.online</span>
        </div>

        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.3, marginBottom: '1.25rem', textWrap: 'balance' }}>
          {titulo}
        </h1>

        <audio
          ref={audioRef}
          controls
          autoPlay
          src={audioApiUrl}
          onTimeUpdate={alAvanzarTiempo}
          style={{ width: '100%', marginBottom: '1.5rem' }}
        />

        <div
          style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14,
            padding: '1.5rem', maxHeight: '65vh', overflowY: 'auto',
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
                color: i === indiceActual ? '#f2b705' : i < indiceActual ? 'rgba(242,237,230,0.45)' : '#f2ede6',
                fontWeight: i === indiceActual ? 800 : 400,
              }}
            >
              {c.text}
            </span>
          ))}
        </div>
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
