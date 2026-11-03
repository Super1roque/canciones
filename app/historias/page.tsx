import type { Metadata } from 'next';
import Link from 'next/link';
import { HISTORIAS, checkoutHistoria } from '@/lib/historias';
import { checkoutMorazan } from '@/lib/accesoAudiolibros';
import { duracionTotalSegundos as duracionMorazan } from '@/lib/morazanCues';
import s from './historias.module.css';

// Índice de «Historias de Honduras»: una tarjeta por libro. La portada de cada tarjeta es la
// misma imagen que se comparte (public/historias/<slug>/portada.jpg).
const TITULO = 'Historias de Honduras — audiolibros de pueblos y lugares';
const DESCRIPCION = 'La historia de los pueblos, ciudades y lugares icónicos de Honduras, contada para escucharla.';

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  openGraph: { title: TITULO, description: DESCRIPCION, url: 'https://corridos.online/historias', siteName: 'Canciones', type: 'website' },
};

// Libros que tienen su propia página fuera de /historias pero también se muestran en la galería.
function otrosLibros() {
  return [
    {
      href: '/morazan',
      portada: '/morazan/portada.jpg',
      lugar: 'Homenajes · Francisco Morazán',
      titulo: 'Morazán: entre la unión y la derrota',
      descripcion: 'Un homenaje a Francisco Morazán (1792-1842): su vida, la Federación Centroamericana y su legado, con un podcast al final.',
      duracion: duracionMorazan,
      enVenta: !!checkoutMorazan(),
    },
  ];
}

function minutos(segundos: number) {
  return `${Math.max(1, Math.round(segundos / 60))} min`;
}

export default function HistoriasPage() {
  return (
    <main className={s.pagina}>
      <div className={s.contenido}>
        <p className={s.etiqueta}>AUDIOLIBROS</p>
        <h1 className={s.titulo}>
          Historias de <span className={s.resaltado}>Honduras</span>
        </h1>
        <p className={s.texto}>
          Pueblos, ciudades y lugares que tienen algo que contar. Cada historia se escucha con el texto, las fotos y los
          sonidos del lugar.
        </p>

        {HISTORIAS.length === 0 && otrosLibros().length === 0 ? (
          <p className={s.pronto}>📍 Muy pronto, las primeras historias.</p>
        ) : (
          <ul className={s.lista}>
            {HISTORIAS.map((h) => (
              <li key={h.slug}>
                <Link href={`/historias/${h.slug}`} className={s.tarjeta}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/historias/${h.slug}/portada.jpg`} alt={h.lugar} className={s.portada} />
                  <div className={s.datos}>
                    <p className={s.lugar}>
                      {h.lugar} · {h.departamento}
                    </p>
                    <p className={s.libro}>{h.titulo}</p>
                    <p className={s.desc}>{h.descripcion}</p>
                    <p className={s.meta}>
                      🎧 {minutos(h.duracion)} · {checkoutHistoria(h) ? 'Primer capítulo gratis' : 'Gratis'}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
            {otrosLibros().map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={s.tarjeta}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.portada} alt={l.titulo} className={s.portada} />
                  <div className={s.datos}>
                    <p className={s.lugar}>{l.lugar}</p>
                    <p className={s.libro}>{l.titulo}</p>
                    <p className={s.desc}>{l.descripcion}</p>
                    <p className={s.meta}>
                      🎧 {minutos(l.duracion)} · {l.enVenta ? 'Primer capítulo gratis' : 'Gratis'}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
