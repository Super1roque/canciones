import type { Metadata } from 'next';
import Link from 'next/link';
import { RADIONOVELAS } from '@/lib/radionovelas';
import s from '../historias/historias.module.css';

// Índice de radionovelas. Usa las mismas tarjetas que la galería de /historias.
const TITULO = '🎙️ Radionovelas — corridos.online';
// Mientras haya una sola radionovela, la imagen para compartir es la suya.
const IMAGEN = `/radionovelas/${RADIONOVELAS[0].slug}/og.jpg`;
const DESCRIPCION = 'Historias hondureñas de ficción, contadas por capítulos con voces, música y sonidos. El primer capítulo es gratis.';

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    images: [{ url: IMAGEN, width: 1200, height: 630, type: 'image/jpeg' }],
    url: 'https://corridos.online/radionovelas',
    siteName: 'Canciones',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: TITULO, description: DESCRIPCION, images: [IMAGEN] },
};

export default function RadionovelasPage() {
  return (
    <main className={s.pagina}>
      <div className={s.contenido}>
        <p className={s.etiqueta}>FICCIÓN SONORA</p>
        <h1 className={s.titulo}>
          <span className={s.resaltado}>Radionovelas</span>
        </h1>
        <p className={s.texto}>Historias de ficción por capítulos, con voces, música y sonidos. El primer capítulo es gratis; los demás, para los miembros.</p>
        <ul className={s.lista}>
          {RADIONOVELAS.map((r) => (
            <li key={r.slug}>
              <Link href={`/radionovelas/${r.slug}`} className={s.tarjeta}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/radionovelas/${r.slug}/og.jpg`} alt={r.titulo} className={s.portada} />
                <div className={s.datos}>
                  <p className={s.lugar}>Radionovela · {r.capitulos.length} capítulos</p>
                  <p className={s.libro}>{r.titulo}</p>
                  <p className={s.desc}>{r.descripcion}</p>
                  <p className={s.meta}>
                    🎙️ {Math.round(r.capitulos.reduce((a, c) => a + c.duracion, 0) / 60)} min · Capítulo 1 gratis
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
