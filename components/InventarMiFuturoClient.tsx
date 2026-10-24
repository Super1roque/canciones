'use client';
import { Fragment, useRef, useState, useCallback } from 'react';
import { Baloo_2, Literata } from 'next/font/google';
import type { CuePárrafo } from '@/lib/inventarMiFuturoCues';
import type { ImagenInline } from '@/lib/inventarMiFuturoImagenes';

const baloo = Baloo_2({ weight: ['600', '700', '800'], subsets: ['latin'] });
const literata = Literata({ weight: ['400', '600'], subsets: ['latin'] });

function formatearTiempo(segundos: number) {
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function InventarMiFuturoClient({
  audioUrl,
  titulo,
  subtitulo,
  cues,
  duracionTotal,
  imagenes,
}: {
  audioUrl: string;
  titulo: string;
  subtitulo: string;
  cues: CuePárrafo[];
  duracionTotal: number;
  imagenes: ImagenInline[];
}) {
  const [indiceActual, setIndiceActual] = useState(-1);
  const [reproduciendo, setReproduciendo] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const parrafoRef = useRef<HTMLParagraphElement>(null);
  const cueIndexRef = useRef(0);

  const imagenesPorCue = imagenes.reduce<Record<number, ImagenInline[]>>((acc, img) => {
    (acc[img.afterCueIdx] ??= []).push(img);
    return acc;
  }, {});

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
        background: 'linear-gradient(160deg, #052019 0%, #0a2b22 45%, #051512 100%)',
        color: '#eafff5',
        fontFamily: literata.style.fontFamily,
      }}
    >
      <div className="blob blob-a" />
      <div className="blob blob-b" />
      <div className="blob blob-c" />

      {/* Barra de audio fija arriba — siempre visible mientras se lee/escucha */}
      <div className="barra-audio glass">
        <div className={baloo.className} style={{ fontSize: '0.78rem', color: '#6ee7b7', letterSpacing: '0.03em', marginBottom: '0.5rem' }}>
          🎧 {reproduciendo ? 'Reproduciendo' : 'Audiolibro'} · {titulo}
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
        <div style={{ fontSize: '0.68rem', color: 'rgba(234,255,245,0.45)', marginTop: '0.3rem', textAlign: 'right' }}>
          {formatearTiempo(duracionTotal)} en total
        </div>
      </div>

      <div style={{ position: 'relative', maxWidth: 680, margin: '0 auto', padding: '1.25rem 1.5rem 5rem' }}>
        <div
          className={baloo.className}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0 1.5rem', opacity: 0.65 }}
        >
          <span style={{ fontSize: '1.1rem' }}>📖</span>
          <span style={{ fontSize: '0.78rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>corridos.online · Mi Historia</span>
        </div>

        <p className="hint">Toca cualquier párrafo para saltar el audio a ese punto.</p>

        <div className="glass texto-libro" style={{ padding: '1.75rem 1.5rem' }}>
          {/* afterCueIdx -1 = antes del primer cue (la portada del libro) */}
          {imagenesPorCue[-1]?.map((foto, fi) => (
            <figure key={fi} className="foto-inline foto-portada">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto.src} alt={foto.alt} />
              {foto.caption && <figcaption>{foto.caption}</figcaption>}
            </figure>
          ))}
          {cues.map((c, i) => {
            const activo = i === indiceActual;
            const leido = i < indiceActual;
            const fotosAqui = imagenesPorCue[i];

            let cueEl;
            if (c.kind === 'heading') {
              const EsTitulo = i === 0;
              cueEl = (
                <h2
                  ref={activo ? (parrafoRef as never) : null}
                  onClick={() => saltarA(c.start)}
                  className={baloo.className}
                  style={{
                    fontSize: EsTitulo ? 'clamp(1.6rem,6vw,2.3rem)' : 'clamp(1.15rem,4vw,1.5rem)',
                    fontWeight: 800,
                    textAlign: EsTitulo ? 'center' : 'left',
                    color: activo ? '#f7cf4a' : '#6ee7b7',
                    margin: EsTitulo ? '0.5rem 0 1.5rem' : '2.5rem 0 1rem',
                    paddingTop: EsTitulo ? 0 : '1.5rem',
                    borderTop: EsTitulo ? 'none' : '1px solid rgba(255,255,255,0.12)',
                    cursor: 'pointer',
                  }}
                >
                  {c.text}
                </h2>
              );
            } else if (c.kind === 'dek') {
              cueEl = (
                <p
                  ref={activo ? parrafoRef : null}
                  onClick={() => saltarA(c.start)}
                  style={{
                    fontStyle: 'italic', textAlign: 'center', cursor: 'pointer',
                    color: activo ? '#f7cf4a' : 'rgba(234,255,245,0.65)',
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
                    color: activo ? '#fff6dd' : leido ? 'rgba(234,255,245,0.55)' : '#eafff5',
                    background: activo ? 'rgba(247,207,74,0.1)' : 'transparent',
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

            return (
              <Fragment key={i}>
                {cueEl}
                {fotosAqui?.map((foto, fi) => (
                  <figure key={fi} className="foto-inline">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={foto.src} alt={foto.alt} loading="lazy" />
                    <figcaption>{foto.caption}</figcaption>
                  </figure>
                ))}
              </Fragment>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', margin: '3rem 0 0.5rem' }}>
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(110,231,183,0.35), transparent)', marginBottom: '2rem' }} />
          <p className={baloo.className} style={{ fontSize: '1rem', color: '#6ee7b7', marginBottom: '0.35rem' }}>
            ✨ Esta historia se escribió con Mi Historia
          </p>
          <p style={{ fontSize: '0.9rem', color: 'rgba(234,255,245,0.75)', marginBottom: '1.75rem' }}>
            Escribí la tuya y creá tu propio libro — <strong style={{ color: '#eafff5' }}>GRATIS</strong>.
          </p>
          <a href="https://corridos.online" className={`${baloo.className} cta-boton`}>
            🎤 Conocer corridos.online
          </a>
        </div>
      </div>

      <style>{`
        .blob { position: absolute; border-radius: 50%; filter: blur(70px); pointer-events: none; z-index: 0; }
        .blob-a { width: 480px; height: 480px; top: -180px; left: -120px; background: rgba(16,185,129,0.35); }
        .blob-b { width: 420px; height: 420px; top: 15%; right: -160px; background: rgba(45,212,191,0.28); }
        .blob-c { width: 520px; height: 520px; bottom: -220px; left: 10%; background: rgba(4,120,87,0.4); }

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

        .hint { text-align:center; font-family: ${baloo.style.fontFamily}, sans-serif; font-size: 0.75rem; color: rgba(234,255,245,0.45); margin: 0 0 1.25rem; }

        .texto-libro p, .texto-libro h2 { transition: background 0.25s, color 0.25s; }
        .texto-libro p:hover, .texto-libro h2:hover { background: rgba(255,255,255,0.06); }

        .foto-inline { margin: 1.5rem 0; text-align: center; }
        .foto-inline img {
          max-width: 100%; max-height: 420px; border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.18);
          box-shadow: 0 10px 28px rgba(0,0,0,0.35);
        }
        .foto-portada { margin: 0 0 1.5rem; }
        .foto-portada img { width: 100%; max-height: none; }
        .foto-inline figcaption {
          font-family: ${baloo.style.fontFamily}, sans-serif;
          font-size: 0.72rem; color: rgba(234,255,245,0.55);
          margin-top: 0.6rem; line-height: 1.5; max-width: 420px; margin-left: auto; margin-right: auto;
        }

        @keyframes pulsoLectura {
          0% { transform: scale(0.99); opacity: 0.7; }
          50% { transform: scale(1.005); }
          100% { transform: scale(1); opacity: 1; }
        }
        .parrafo-activo { animation: pulsoLectura 0.3s ease; }

        .cta-boton {
          display: inline-block;
          padding: 0.9rem 2rem;
          border-radius: 999px;
          background: linear-gradient(135deg, #ffd84d, #f2b705 55%, #e08a1b);
          color: #2a1608;
          font-weight: 800;
          font-size: 1rem;
          text-decoration: none;
          letter-spacing: 0.01em;
          box-shadow: 0 8px 24px rgba(242,183,5,0.35);
          transition: transform 0.15s ease;
        }
        .cta-boton:hover { transform: scale(1.05); }
        .cta-boton:active { transform: scale(0.97); }

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
