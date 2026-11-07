import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import AccesoMiembro from '@/components/AccesoMiembro';
import { COOKIE_MIEMBRO, checkoutApoya, miembroActivo } from '@/lib/miembrosApoya';
import { RADIONOVELAS } from '@/lib/radionovelas';
import s from '../historias/historias.module.css';
import r from './radionovelas.module.css';
// (dentro de la lista, «r» es cada radionovela; las clases de la miniatura se usan con este otro nombre)
import mini from './radionovelas.module.css';

// Índice de radionovelas. Usa las mismas tarjetas que la galería de /historias.
const TITULO = '🎙️ Radionovelas — corridos.online';
// La imagen para compartir muestra las portadas de todas las radionovelas (se hace con un script fuera del repo).
const IMAGEN = '/radionovelas/og.jpg';
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

export default async function RadionovelasPage() {
  const miembro = await miembroActivo((await cookies()).get(COOKIE_MIEMBRO)?.value);
  const checkout = checkoutApoya();
  return (
    <main className={s.pagina}>
      <div className={s.contenido}>
        <p className={s.etiqueta}>FICCIÓN SONORA</p>
        <h1 className={s.titulo}>
          <span className={s.resaltado}>Radionovelas</span>
        </h1>
        <p className={s.texto}>Historias de ficción por capítulos, con voces, música y sonidos. El primer capítulo es gratis; los demás, para los miembros.</p>
        {miembro ? (
          <p className={r.miembro}>✅ Sos miembro: todas las radionovelas están abiertas.</p>
        ) : (
          <section className={r.acceso}>
            <p className={r.accesoTitulo}>🎙️ Escuchalas completas con la membresía</p>
            <p className={r.accesoTexto}>US$ 2.99 al mes (en Honduras, unos L 85): todas las radionovelas, las de ahora y las que vengan, más el grupo privado de WhatsApp.</p>
            <a href={checkout || '/apoya'} className={r.boton}>
              Hacerme miembro
            </a>
            <AccesoMiembro etiqueta="¿Ya sos miembro? Escribí tu correo y se abren todas:" clases={{ form: r.form, error: r.error }} />
          </section>
        )}

        <ul className={s.lista}>
          {RADIONOVELAS.map((r) => (
            <li key={r.slug}>
              <Link href={`/radionovelas/${r.slug}`} className={s.tarjeta}>
                {/* la portada con un botón de play encima, para que se entienda que es para escuchar */}
                <div className={mini.miniatura}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/radionovelas/${r.slug}/og.jpg`} alt={r.titulo} className={s.portada} />
                  <span className={mini.play} aria-hidden="true" />
                  <span className={mini.escuchar}>🎧 Escuchar</span>
                </div>
                <div className={s.datos}>
                  <p className={s.lugar}>Radionovela · {r.capitulos.length} {r.capitulos.length === 1 ? 'capítulo' : 'capítulos'}</p>
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
