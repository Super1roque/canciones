'use client';
import { useRef, useState } from 'react';
import { Baloo_2, Literata } from 'next/font/google';

const baloo = Baloo_2({ weight: ['600', '700', '800'], subsets: ['latin'] });
const literata = Literata({ weight: ['400', '600'], subsets: ['latin'] });

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
    <div
      style={{
        minHeight: '100vh',
        background: `
          radial-gradient(ellipse 900px 600px at 50% -5%, rgba(242,183,5,0.22) 0%, rgba(242,183,5,0) 60%),
          linear-gradient(160deg, #3a1810 0%, #241009 45%, #150b08 100%)
        `,
        color: '#f2ede6',
        fontFamily: literata.style.fontFamily,
      }}
    >
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>
        <div
          className={baloo.className}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.75rem', opacity: 0.65 }}
        >
          <span style={{ fontSize: '1.2rem' }}>📖</span>
          <span style={{ fontSize: '0.8rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>corridos.online</span>
        </div>

        <h1
          className={baloo.className}
          style={{
            fontSize: 'clamp(1.5rem, 5vw, 2.1rem)', fontWeight: 800, lineHeight: 1.25,
            marginBottom: '1.75rem', textWrap: 'balance', color: '#fbead0',
          }}
        >
          {titulo}
        </h1>

        <div
          style={{
            background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(242,183,5,0.25)', borderRadius: 18,
            padding: '1.1rem 1.1rem 1.3rem', marginBottom: '1.75rem',
            boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
          }}
        >
          <div className={baloo.className} style={{ fontSize: '0.78rem', color: '#f2b705', letterSpacing: '0.04em', marginBottom: '0.6rem', textTransform: 'uppercase' }}>
            🎧 Escuchá la lectura
          </div>
          <audio
            ref={audioRef}
            controls
            autoPlay
            src={audioApiUrl}
            onTimeUpdate={alAvanzarTiempo}
            style={{ width: '100%', display: 'block' }}
          />
        </div>

        <div
          style={{
            background: 'linear-gradient(180deg, rgba(255,250,240,0.05), rgba(255,250,240,0.02))',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18,
            padding: '1.75rem', maxHeight: '62vh', overflowY: 'auto',
            fontSize: '1.15rem', lineHeight: 2.1,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
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
                color: i === indiceActual ? '#f7cf4a' : i < indiceActual ? 'rgba(242,237,230,0.4)' : '#f2ede6',
                fontWeight: i === indiceActual ? 700 : 400,
              }}
            >
              {c.text}
            </span>
          ))}
        </div>

        <div style={{ textAlign: 'center', margin: '3rem 0 0.5rem' }}>
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(242,183,5,0.35), transparent)', marginBottom: '2rem' }} />
          <p className={baloo.className} style={{ fontSize: '1.05rem', color: '#f2b705', marginBottom: '0.35rem' }}>
            🎉 ¿Te gustó esta lectura?
          </p>
          <p style={{ fontSize: '0.95rem', color: 'rgba(242,237,230,0.75)', marginBottom: '1.75rem' }}>
            Creá tu propia canción parodia <strong style={{ color: '#fbead0' }}>GRATIS</strong> — probá nuestro sistema.
          </p>
          <a href="https://corridos.online" className={`${baloo.className} cta-boton`}>
            🎤 Crear mi canción gratis
          </a>
        </div>
      </div>

      <style>{`
        @keyframes pulsoLectura {
          0% { transform: scale(0.7); opacity: 0.6; }
          50% { transform: scale(1.25); }
          100% { transform: scale(1); opacity: 1; }
        }
        .palabra-leyendo { animation: pulsoLectura 0.28s cubic-bezier(.34,1.56,.64,1); }

        .cta-boton {
          display: inline-block;
          padding: 1rem 2.2rem;
          border-radius: 999px;
          background: linear-gradient(135deg, #ffd84d, #f2b705 55%, #e08a1b);
          color: #2a1608;
          font-weight: 800;
          font-size: 1.05rem;
          text-decoration: none;
          letter-spacing: 0.01em;
          box-shadow: 0 8px 24px rgba(242,183,5,0.35), 0 0 0 rgba(242,183,5,0.5);
          animation: latidoCta 2.2s ease-in-out infinite;
          transition: transform 0.15s ease;
        }
        .cta-boton:hover { transform: scale(1.05); }
        .cta-boton:active { transform: scale(0.97); }

        @keyframes latidoCta {
          0%, 100% { transform: scale(1); box-shadow: 0 8px 24px rgba(242,183,5,0.35), 0 0 0 rgba(242,183,5,0.45); }
          50% { transform: scale(1.045); box-shadow: 0 10px 32px rgba(242,183,5,0.5), 0 0 22px rgba(242,183,5,0.35); }
        }

        @media (prefers-reduced-motion: reduce) {
          .palabra-leyendo { animation: none; }
          .cta-boton { animation: none; }
        }
      `}</style>
    </div>
  );
}
