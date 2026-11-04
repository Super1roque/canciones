'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Capitulo, Personaje } from '@/lib/radionovelas';
import s from './RadionovelaClient.module.css';

type Props = {
  slug: string;
  titulo: string;
  lema: string;
  aviso: string;
  personajes: Record<string, Personaje>;
  ocultos: Record<string, { hasta: number; nombre: string }>;
  capitulo: Capitulo;
  indice: { n: number; titulo: string; duracion: number; gratis: boolean }[];
  abierto: boolean;
  miembro: boolean;
  audioUrl: string;
  checkout: string | null;
};

const minutos = (seg: number) => `${Math.floor(seg / 60)}:${String(Math.floor(seg % 60)).padStart(2, '0')}`;

export default function RadionovelaClient(p: Props) {
  const cap = p.capitulo;
  const audio = useRef<HTMLAudioElement>(null);
  const filas = useRef<(HTMLDivElement | null)[]>([]);
  const [t, setT] = useState(0);
  const [sonando, setSonando] = useState(false);
  const [dur, setDur] = useState(cap.duracion);

  // El guion: líneas y marcas de escena en el orden en que suenan.
  const guion = useMemo(
    () =>
      [
        ...cap.lineas.map((l) => ({ ...l, escena: false })),
        ...cap.escenas.map((e) => ({ t: e.t, e: e.t + 1, p: '', x: e.x, escena: true })),
      ].sort((a, b) => a.t - b.t),
    [cap],
  );
  // Quién sale en este capítulo, en el orden en que aparece (el narrador primero).
  const reparto = useMemo(() => {
    const orden: string[] = [];
    for (const l of cap.lineas) if (!orden.includes(l.p)) orden.push(l.p);
    return orden.sort((a, b) => (a === 'N' ? -1 : b === 'N' ? 1 : 0));
  }, [cap]);
  const nombre = (k: string) => (p.ocultos[k] && cap.n < p.ocultos[k].hasta ? p.ocultos[k].nombre : p.personajes[k].nombre);
  const oculto = (k: string) => !!p.ocultos[k] && cap.n < p.ocultos[k].hasta;

  let activa = -1;
  guion.forEach((l, i) => {
    if (!l.escena && t >= l.t - 0.1) activa = i;
  });
  const hablando = activa >= 0 && t <= guion[activa].e + 0.4 ? guion[activa].p : null;

  useEffect(() => {
    if (activa >= 0) filas.current[activa]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activa]);

  const saltar = (seg: number) => {
    if (!audio.current) return;
    audio.current.currentTime = seg;
    audio.current.play();
  };
  const siguiente = p.indice.find((c) => c.n === cap.n + 1);

  return (
    <main className={s.pagina}>
      <div className={s.contenido}>
        <p className={s.etiqueta}>🎙️ RADIONOVELA · FICCIÓN</p>
        <h1 className={s.titulo}>{p.titulo}</h1>
        <p className={s.lema}>{p.lema}</p>

        <section className={s.cap}>
          <p className={s.capEtiqueta}>
            CAPÍTULO {cap.n} · {p.indice.find((c) => c.n === cap.n)?.gratis ? 'GRATIS' : 'PARA MIEMBROS'}
          </p>
          <h2 className={s.capTitulo}>{cap.titulo}</h2>
          <p className={s.capResumen}>{cap.resumen}</p>
        </section>

        {p.abierto ? (
          <>
            <div className={s.reparto}>
              {reparto.map((k) => (
                <div key={k} className={`${s.persona} ${hablando === k ? s.habla : ''}`} style={{ ['--col' as string]: p.personajes[k].color }}>
                  <div className={s.avatar}>{oculto(k) ? '?' : (p.personajes[k].inicial ?? nombre(k)[0])}</div>
                  <span>{nombre(k)}</span>
                  <i>{oculto(k) ? '???' : p.personajes[k].edad}</i>
                </div>
              ))}
            </div>
            <div className={s.guion}>
              {guion.map((l, i) =>
                l.escena ? (
                  <div key={i} className={s.escena}>
                    {l.x}
                  </div>
                ) : (
                  <div
                    key={i}
                    ref={(el) => {
                      filas.current[i] = el;
                    }}
                    className={`${s.linea} ${l.p === 'N' ? s.narrador : ''} ${i === activa ? s.activa : i < activa ? s.leida : ''}`}
                    onClick={() => saltar(l.t)}
                  >
                    <p className={s.quien} style={{ color: p.personajes[l.p].color }}>
                      {nombre(l.p).toUpperCase()}
                    </p>
                    <p className={s.texto}>{l.x}</p>
                  </div>
                ),
              )}
            </div>
            <p className={s.aviso}>{p.aviso}</p>
            {siguiente ? (
              <Link href={`/radionovelas/${p.slug}?cap=${siguiente.n}`} className={s.botonSiguiente}>
                Siguiente: Capítulo {siguiente.n} · {siguiente.titulo} →
              </Link>
            ) : null}
          </>
        ) : (
          <Candado checkout={p.checkout} />
        )}

        <section className={s.lista}>
          <h2>Capítulos</h2>
          {p.indice.map((c) => {
            const libre = c.gratis || p.miembro;
            return (
              <Link key={c.n} href={`/radionovelas/${p.slug}?cap=${c.n}`} className={`${s.ep} ${c.n === cap.n ? s.epActual : ''}`}>
                <span>
                  {c.n}. {c.titulo}
                  <small>{minutos(c.duracion)}</small>
                </span>
                <em className={c.gratis ? s.gratis : libre ? s.abierto : s.cerrado}>
                  {c.n === cap.n ? 'Escuchando' : c.gratis ? 'Gratis' : libre ? '▶ Escuchar' : '🔒 Miembros'}
                </em>
              </Link>
            );
          })}
        </section>
      </div>

      {p.abierto ? (
        <div className={s.barra}>
          <div>
            <button onClick={() => (audio.current?.paused ? audio.current.play() : audio.current?.pause())} aria-label={sonando ? 'Pausar' : 'Escuchar'}>
              {sonando ? '❚❚' : '▶'}
            </button>
            <input
              type="range"
              min={0}
              max={dur}
              step={0.1}
              value={t}
              onChange={(e) => audio.current && (audio.current.currentTime = Number(e.target.value))}
              aria-label="Avance del capítulo"
            />
            <span>
              {minutos(t)} / {minutos(dur)}
            </span>
          </div>
          <audio
            ref={audio}
            src={p.audioUrl}
            preload="metadata"
            onPlay={() => setSonando(true)}
            onPause={() => setSonando(false)}
            onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDur(e.currentTarget.duration || cap.duracion)}
          />
        </div>
      ) : null}
    </main>
  );
}

function Candado({ checkout }: { checkout: string | null }) {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'' | 'enviando' | 'no' | 'error'>('');
  const [mensaje, setMensaje] = useState('');
  const abrir = async (e: React.FormEvent) => {
    e.preventDefault();
    setEstado('enviando');
    const r = await fetch('/api/apoya/desbloquear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      .then((x) => x.json())
      .catch(() => ({ ok: false, error: 'No se pudo comprobar. Intenta de nuevo.' }));
    if (r.ok) return window.location.reload();
    setEstado(r.error ? 'error' : 'no');
    setMensaje(r.error || 'No encontramos una membresía activa con ese correo. Usa el mismo con el que pagaste en Hotmart.');
  };
  return (
    <section className={s.candado}>
      <p className={s.candadoIcono}>🔒</p>
      <h3>Este capítulo es para miembros</h3>
      <p>
        Con la membresía de <strong>US$ 2.99 al mes</strong> escuchás la radionovela completa, sin esperar los cortes de TikTok, y además
        entrás al grupo privado de WhatsApp.
      </p>
      <a href={checkout || '/apoya'} className={s.botonMiembro}>
        Hacerme miembro
      </a>
      <form onSubmit={abrir} className={s.form}>
        <label htmlFor="correo-miembro">¿Ya sos miembro? Escribí el correo con el que pagás:</label>
        <div>
          <input id="correo-miembro" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
          <button type="submit" disabled={estado === 'enviando'}>
            {estado === 'enviando' ? 'Revisando…' : 'Abrir'}
          </button>
        </div>
        {estado === 'no' || estado === 'error' ? <p className={s.formError}>{mensaje}</p> : null}
      </form>
    </section>
  );
}
