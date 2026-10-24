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
  etiqueta = 'corridos.online · Mi Historia',
  invitacion = 'Escribí la tuya y creá tu propio libro',
  remate = 'GRATIS',
  cta = { texto: '🎤 Conocer corridos.online', href: 'https://corridos.online' },
}: {
  audioUrl: string;
  titulo: string;
  subtitulo: string;
  cues: CuePárrafo[];
  duracionTotal: number;
  imagenes: ImagenInline[];
  // Opcionales: cada página de audiolibro puede cambiar la etiqueta de arriba y el llamado del final.
  etiqueta?: string;
  invitacion?: string;
  remate?: string;
  cta?: { texto: string; href: string };
}) {
  const [indiceActual, setIndiceActual] = useState(-1);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [tiempo, setTiempo] = useState(0);
  // La flecha "Play para escuchar" se muestra hasta la primera reproducción.
  const [yaEmpezo, setYaEmpezo] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const parrafoRef = useRef<HTMLParagraphElement>(null);
  const cueIndexRef = useRef(0);

  const imagenesPorCue = imagenes.reduce<Record<number, ImagenInline[]>>((acc, img) => {
    (acc[img.afterCueIdx] ??= []).push(img);
    return acc;
  }, {});

  const alAvanzarTiempo = useCallback(() => {
    const t = audioRef.current?.currentTime ?? 0;
    setTiempo(t);
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

  // Pausar no mueve el scroll: el lector queda donde está y al reanudar sigue desde el mismo punto.
  function alternarReproduccion() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play();
    else a.pause();
  }

  function buscar(segundos: number) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = segundos;
    setTiempo(segundos);
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

      <audio
        ref={audioRef}
        preload="none"
        src={audioUrl}
        onTimeUpdate={alAvanzarTiempo}
        onPlay={() => { setReproduciendo(true); setYaEmpezo(true); }}
        onPause={() => setReproduciendo(false)}
        onWaiting={() => setCargando(true)}
        onPlaying={() => setCargando(false)}
        onCanPlay={() => setCargando(false)}
      />

      {/* Reproductor flotante — siempre a mano para pausar/reanudar sin perder el punto de lectura */}
      <div className="barra-audio">
        <button
          type="button"
          onClick={alternarReproduccion}
          className="boton-play"
          aria-label={reproduciendo ? 'Pausar' : 'Reproducir'}
        >
          {cargando && reproduciendo ? (
            <span className="spinner" />
          ) : reproduciendo ? (
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" /></svg>
          )}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={`${baloo.className} barra-titulo`}>
            🎧 {reproduciendo ? 'Reproduciendo' : tiempo > 0 ? 'En pausa' : 'Audiolibro'} · {titulo}
          </div>
          <input
            type="range"
            className="barra-progreso"
            min={0}
            max={duracionTotal}
            step={1}
            value={Math.min(tiempo, duracionTotal)}
            onChange={(e) => buscar(Number(e.target.value))}
            aria-label="Posición del audio"
            style={{ ['--progreso' as string]: `${(Math.min(tiempo, duracionTotal) / duracionTotal) * 100}%` }}
          />
          <div className="barra-tiempos">
            <span>{formatearTiempo(tiempo)}</span>
            <span>{formatearTiempo(duracionTotal)}</span>
          </div>
        </div>

        {!yaEmpezo && (
          <div className={`${baloo.className} aviso-play`} aria-hidden="true">
            <svg viewBox="0 0 40 60" width="34" height="50">
              <path d="M20 56 V10" stroke="#f7cf4a" strokeWidth="4" strokeLinecap="round" fill="none" />
              <path d="M8 22 L20 8 L32 22" stroke="#f7cf4a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span>Play para escuchar</span>
          </div>
        )}
      </div>

      <div style={{ position: 'relative', maxWidth: 680, margin: '0 auto', padding: '7rem 1.5rem 5rem' }}>
        <div
          className={baloo.className}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0 1.5rem', opacity: 0.65 }}
        >
          <span style={{ fontSize: '1.1rem' }}>📖</span>
          <span style={{ fontSize: '0.78rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{etiqueta}</span>
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
            {invitacion} — <strong style={{ color: '#eafff5' }}>{remate}</strong>.
          </p>
          <a
            href={cta.href}
            {...(cta.href.startsWith('https://wa.me/') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className={`${baloo.className} cta-boton`}
          >
            {cta.texto}
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
          position: fixed; z-index: 50;
          top: 10px; left: 50%; transform: translateX(-50%);
          width: min(680px, calc(100% - 20px));
          display: flex; align-items: center; gap: 0.9rem;
          padding: 0.7rem 1.1rem 0.6rem 0.75rem;
          border-radius: 999px;
          background: rgba(5,32,25,0.82);
          border: 1px solid rgba(110,231,183,0.28);
          box-shadow: 0 12px 34px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12);
          backdrop-filter: blur(18px) saturate(150%);
          -webkit-backdrop-filter: blur(18px) saturate(150%);
        }
        .boton-play {
          flex: none; width: 52px; height: 52px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          border: none; cursor: pointer; color: #2a1608;
          background: linear-gradient(135deg, #ffd84d, #f2b705 55%, #e08a1b);
          box-shadow: 0 6px 18px rgba(242,183,5,0.4);
          transition: transform 0.15s ease;
        }
        .boton-play:hover { transform: scale(1.06); }
        .boton-play:active { transform: scale(0.94); }
        .spinner {
          width: 20px; height: 20px; border-radius: 50%;
          border: 3px solid rgba(42,22,8,0.25); border-top-color: #2a1608;
          animation: girar 0.8s linear infinite;
        }
        @keyframes girar { to { transform: rotate(360deg); } }
        .barra-titulo {
          font-size: 0.76rem; color: #6ee7b7; letter-spacing: 0.03em;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .barra-progreso {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 6px; margin: 0.4rem 0 0.25rem; border-radius: 999px; cursor: pointer;
          background: linear-gradient(90deg, #f7cf4a var(--progreso), rgba(255,255,255,0.18) var(--progreso));
        }
        .barra-progreso::-webkit-slider-thumb {
          -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%;
          background: #fff6dd; border: none; box-shadow: 0 0 0 3px rgba(247,207,74,0.35);
        }
        .barra-progreso::-moz-range-thumb {
          width: 14px; height: 14px; border-radius: 50%;
          background: #fff6dd; border: none; box-shadow: 0 0 0 3px rgba(247,207,74,0.35);
        }
        .barra-tiempos {
          display: flex; justify-content: space-between;
          font-size: 0.66rem; color: rgba(234,255,245,0.5); font-variant-numeric: tabular-nums;
        }

        /* Flecha que sube hacia el botón de play hasta que se reproduce por primera vez */
        .aviso-play {
          position: absolute; top: calc(100% + 6px); left: 0.75rem;
          width: 52px; display: flex; flex-direction: column; align-items: center;
          pointer-events: none;
          animation: subirFlecha 1.1s ease-in-out infinite;
        }
        .aviso-play span {
          margin-top: 0.15rem; white-space: nowrap;
          font-size: 0.85rem; font-weight: 800; color: #2a1608;
          background: #f7cf4a; padding: 0.3rem 0.75rem; border-radius: 999px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.35);
          transform: translateX(35%);
        }
        @keyframes subirFlecha {
          0%, 100% { transform: translateY(8px); opacity: 0.85; }
          50% { transform: translateY(-4px); opacity: 1; }
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
          .barra-audio { padding: 0.55rem 0.9rem 0.5rem 0.55rem; gap: 0.7rem; }
          .aviso-play { left: 0.55rem; }
          .texto-libro { padding: 1.1rem 1rem !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          .parrafo-activo, .aviso-play { animation: none; }
        }
      `}</style>
    </div>
  );
}
