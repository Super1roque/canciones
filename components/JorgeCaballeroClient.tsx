'use client';
import { useRef, useState, useCallback } from 'react';
import { Baloo_2, Literata } from 'next/font/google';
import type { CuePárrafo } from '@/lib/jorgeCaballeroCues';

const baloo = Baloo_2({ weight: ['600', '700', '800'], subsets: ['latin'] });
const literata = Literata({ weight: ['400', '600'], subsets: ['latin'] });

function formatearTiempo(segundos: number) {
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function JorgeCaballeroClient({
  audioUrl,
  cues,
  duracionTotal,
}: {
  audioUrl: string;
  cues: CuePárrafo[];
  duracionTotal: number;
}) {
  const [indiceActual, setIndiceActual] = useState(-1);
  const [reproduciendo, setReproduciendo] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const parrafoRef = useRef<HTMLParagraphElement>(null);
  const cueIndexRef = useRef(0);

  const alAvanzarTiempo = useCallback(() => {
    const t = audioRef.current?.currentTime ?? 0;
    if (cues.length === 0) return;
    let i = cueIndexRef.current;
    while (i < cues.length - 1 && cues[i].end <= t) i++;
    while (i > 0 && cues[i].start > t) i--;
    if (i !== cueIndexRef.current) {
      cueIndexRef.current = i;
      setIndiceActual(i);
      parrafoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [cues]);

  function saltarA(start: number) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = start + 0.02;
    audioRef.current.play();
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        position: 'relative',
        background: 'linear-gradient(160deg, #2b0505 0%, #3a0a0a 45%, #1a0303 100%)',
        color: '#fff5f0',
        fontFamily: literata.style.fontFamily,
      }}
    >
      <div className="blob blob-a" />
      <div className="blob blob-b" />

      <div className="barra-audio glass">
        <div className={baloo.className} style={{ fontSize: '0.78rem', color: '#ff8a7a', letterSpacing: '0.03em', marginBottom: '0.5rem' }}>
          🎧 {reproduciendo ? 'Reproduciendo' : 'Reportaje narrado'} · 50 años de servicio
        </div>
        <audio
          ref={audioRef}
          controls
          preload="none"
          src={audioUrl}
          onTimeUpdate={alAvanzarTiempo}
          onPlay={() => setReproduciendo(true)}
          onPause={() => setReproduciendo(false)}
          style={{ width: '100%', display: 'block', height: 36 }}
        />
        <div style={{ fontSize: '0.68rem', color: 'rgba(255,245,240,0.45)', marginTop: '0.3rem', textAlign: 'right' }}>
          {formatearTiempo(duracionTotal)} en total
        </div>
      </div>

      <div style={{ position: 'relative', maxWidth: 680, margin: '0 auto', padding: '1.25rem 1.5rem 5rem' }}>
        <div
          className={baloo.className}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0 1.5rem', opacity: 0.65 }}
        >
          <span style={{ fontSize: '1.1rem' }}>🩹</span>
          <span style={{ fontSize: '0.78rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Cruz Roja Hondureña</span>
        </div>

        <p className="hint">Toca cualquier párrafo para saltar el audio a ese punto.</p>

        <div className="glass texto-libro" style={{ padding: '1.75rem 1.5rem' }}>
          {cues.map((c, i) => {
            const activo = i === indiceActual;
            const leido = i < indiceActual;

            let cueEl;
            if (c.kind === 'heading') {
              cueEl = (
                <h1
                  ref={activo ? (parrafoRef as never) : null}
                  onClick={() => saltarA(c.start)}
                  className={baloo.className}
                  style={{
                    fontSize: 'clamp(1.8rem,7vw,2.6rem)',
                    fontWeight: 800,
                    textAlign: 'center',
                    color: activo ? '#ffd24a' : '#ff8a7a',
                    margin: '0.5rem 0 1.5rem',
                    cursor: 'pointer',
                  }}
                >
                  {c.text}
                </h1>
              );
            } else if (c.kind === 'dek') {
              cueEl = (
                <p
                  ref={activo ? parrafoRef : null}
                  onClick={() => saltarA(c.start)}
                  style={{
                    fontStyle: 'italic', textAlign: 'center', cursor: 'pointer',
                    color: activo ? '#ffd24a' : 'rgba(255,245,240,0.65)',
                    margin: '0 0 1.5rem',
                  }}
                >
                  {c.text}
                </p>
              );
            } else {
              cueEl = (
                <p
                  ref={activo ? parrafoRef : null}
                  onClick={() => saltarA(c.start)}
                  className={activo ? 'parrafo-activo' : undefined}
                  style={{
                    cursor: 'pointer',
                    color: activo ? '#fff6dd' : leido ? 'rgba(255,245,240,0.55)' : '#fff5f0',
                    background: activo ? 'rgba(255,210,74,0.1)' : 'transparent',
                    borderRadius: 10,
                    padding: '0.3rem 0.5rem',
                    margin: '0 -0.5rem 1.1rem',
                    lineHeight: 1.85,
                    fontSize: '1.05rem',
                    textAlign: 'justify',
                  }}
                >
                  {c.text}
                </p>
              );
            }

            return cueEl;
          })}
        </div>
      </div>

      <style>{`
        .blob { position: absolute; border-radius: 50%; filter: blur(70px); pointer-events: none; z-index: 0; }
        .blob-a { width: 480px; height: 480px; top: -180px; left: -120px; background: rgba(220,38,38,0.35); }
        .blob-b { width: 420px; height: 420px; bottom: -200px; right: -140px; background: rgba(185,28,28,0.3); }

        .glass {
          position: relative;
          border-radius: 20px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.18);
          box-shadow: 0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15);
          backdrop-filter: blur(18px) saturate(150%);
          -webkit-backdrop-filter: blur(18px) saturate(150%);
        }

        .barra-audio {
          position: sticky; top: 0; z-index: 10;
          margin: 0 0 0.5rem; padding: 0.85rem 1.2rem;
          border-radius: 0 0 16px 16px;
          max-width: 680px; margin-left: auto; margin-right: auto;
        }

        .hint { text-align:center; font-family: ${baloo.style.fontFamily}, sans-serif; font-size: 0.75rem; color: rgba(255,245,240,0.45); margin: 0 0 1.25rem; }

        .texto-libro p, .texto-libro h1 { transition: background 0.25s, color 0.25s; }
        .texto-libro p:hover, .texto-libro h1:hover { background: rgba(255,255,255,0.06); }

        @keyframes pulsoLectura {
          0% { transform: scale(0.99); opacity: 0.7; }
          50% { transform: scale(1.005); }
          100% { transform: scale(1); opacity: 1; }
        }
        .parrafo-activo { animation: pulsoLectura 0.3s ease; }

        @media (max-width: 480px) {
          .barra-audio { padding: 0.65rem 0.9rem; border-radius: 0; }
          .texto-libro { padding: 1.1rem 1rem !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          .parrafo-activo { animation: none; }
        }
      `}</style>
    </div>
  );
}
