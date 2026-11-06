'use client';

import type { Capitulo, Personaje } from '@/lib/radionovelas';
import s from './RadionovelaComic.module.css';

// El escenario de las radionovelas en estilo cómic (como su video de TikTok en pop art): el que habla sale recortado
// en una viñeta con rayos de su color y rebota con cada palabra; lo que dice va en un globo (el narrador, en un
// recuadro), con la palabra que suena en rojo; las líneas de un video viejo salen en gris con «ARCHIVO», y las
// onomatopeyas estallan cuando suena el mazo o la tos.
type Props = {
  t: number;
  capitulo: Capitulo;
  personajes: Record<string, Personaje>;
  nombre: (k: string) => string;
  sonando: boolean;
  alPulsar: () => void;
};

// Las palabras de una línea en grupos cortos, como los subtítulos del video: hasta 7 palabras, cortando en la puntuación.
function grupos(x: string) {
  const palabras = x.split(' ');
  const res: number[][] = [];
  let actual: number[] = [];
  palabras.forEach((w, i) => {
    actual.push(i);
    if (actual.length >= 7 || (actual.length >= 3 && /[.,?!:…]$/.test(w))) {
      res.push(actual);
      actual = [];
    }
  });
  if (actual.length) res.push(actual);
  return res;
}

// La estrella del estallido de las onomatopeyas.
const ESTRELLA = Array.from({ length: 28 }, (_, i) => {
  const a = (Math.PI * i) / 14;
  const r = i % 2 ? 31 : 50 - (i % 4) * 2;
  return `${(50 + r * Math.cos(a)).toFixed(1)}% ${(50 + r * Math.sin(a) * 0.86).toFixed(1)}%`;
}).join(', ');
const ONO_COLOR = ['#e82832', '#ffffff', '#28c8e6', '#ffffff'];
const ONO_LETRA = ['#ffde00', '#1e96e6', '#ffde00', '#e82832'];

export default function RadionovelaComic({ t, capitulo, personajes, nombre, sonando, alPulsar }: Props) {
  const lineas = capitulo.lineas;
  let k = 0;
  lineas.forEach((l, i) => {
    if (t >= l.t - 0.1) k = i;
  });
  const l = lineas[k];
  if (!l) return null;
  const enGlobo = t >= l.t - 0.1 && t <= l.e + 0.6;
  const palabras = l.x.split(' ');
  const w = l.w ?? palabras.map((_, i) => l.t + ((l.e - l.t) * i) / palabras.length);
  let actual = -1;
  w.forEach((x, i) => {
    if (t >= x - 0.05) actual = i;
  });
  const grupo = grupos(l.x).find((g) => g.includes(Math.max(0, actual))) ?? [];
  const finPalabra = (i: number) => (i + 1 < w.length ? w[i + 1] : l.e);
  const enPalabra = actual >= 0 && t < finPalabra(actual) + 0.05 && enGlobo;
  const per = personajes[l.p];
  const narr = l.p === 'N';
  const escena = capitulo.escenas.find((e) => t >= e.t && t < e.t + 3.8);
  const onos = (capitulo.ono ?? []).map((o, i) => ({ ...o, i })).filter((o) => t >= o.t && t < o.t + 1.5);

  return (
    <section className={s.escenario}>
      <div
        className={`${s.vineta} ${l.a ? s.archivo : ''}`}
        style={{ ['--col' as string]: l.a ? '#968c7d' : per.color }}
      >
        {per.cara ? (
          // el rebote se reinicia en cada palabra alternando dos animaciones iguales
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={l.p}
            src={`${per.cara}.webp`}
            alt={nombre(l.p)}
            className={`${s.figura} ${enPalabra ? (actual % 2 ? s.reboteA : s.reboteB) : ''}`}
          />
        ) : null}
        {l.a ? <span className={s.etiquetaArchivo}>▶ ARCHIVO · HACE UNOS AÑOS</span> : null}
        {escena ? <span className={s.recuadroEscena}>{escena.x.toUpperCase()}</span> : null}
        {onos.map((o) => (
          <span
            key={o.i}
            className={`${s.ono} ${o.i % 2 ? s.onoIzq : s.onoDer}`}
            style={{ ['--fondo' as string]: ONO_COLOR[o.i % 4], ['--letra' as string]: ONO_LETRA[o.i % 4], ['--estrella' as string]: `polygon(${ESTRELLA})` }}
          >
            <i />
            <b>{o.x}</b>
          </span>
        ))}
        {!sonando && t < 0.5 ? (
          <button className={s.play} onClick={alPulsar} aria-label="Escuchar">
            ▶ ESCUCHAR
          </button>
        ) : null}
      </div>

      <div className={s.zonaGlobo}>
        {enGlobo ? (
          <div className={narr ? s.recuadro : s.globo}>
            <span className={s.nombre} style={{ background: per.color }}>
              {nombre(l.p).toUpperCase()}
            </span>
            <p>
              {grupo.map((i) => (
                <span key={i} className={i === actual && enPalabra ? s.suena : i < actual || (i === actual && !enPalabra) ? s.dicha : s.falta}>
                  {palabras[i]}{' '}
                </span>
              ))}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
