import type { Metadata } from 'next';
import Formulario from './Formulario';
import VideoEjemplo from './VideoEjemplo';
import { MENSAJE_WHATSAPP, PRECIO_VIDEO, WHATSAPP_ARMANDO } from './datos';
import s from './pagina.module.css';

// Página de destino de la campaña: quien tiene una canción en audio deja sus datos, el audio y las fotos,
// y recibe gratis una muestra de 20 segundos. El video completo se cobra por WhatsApp.
const TITULO = 'Convierte tu canción en un video';
const DESCRIPCION = `Mándame el audio y la foto de los protagonistas. Te hago gratis una muestra de 20 segundos. Video completo: ${PRECIO_VIDEO}.`;
export const metadata: Metadata = { title: TITULO, description: DESCRIPCION, openGraph: { title: TITULO, description: DESCRIPCION } };

const PASOS = [
  ['1', 'Mándame tu canción', 'El audio y, si salen personas reales, sus fotos.'],
  ['2', 'Recibe tu muestra gratis', 'Te hago 20 segundos con tu propia canción y te los mando por WhatsApp.'],
  ['3', 'Si te gusta, lo terminamos', `El video completo, con su letra y las escenas de tu historia, por ${PRECIO_VIDEO}.`],
];

export default function Pagina() {
  const whatsapp = `https://wa.me/${WHATSAPP_ARMANDO}?text=${encodeURIComponent(MENSAJE_WHATSAPP)}`;
  return (
    <main className={s.pagina}>
      <div className={s.contenido}>
        <p className={s.etiqueta}>VIDEOS PARA CANCIONES</p>
        <h1 className={s.titulo}>¿Tienes una canción? <span className={s.resaltado}>Te hago su video</span></h1>
        <p className={s.texto}>Con tu historia, tus personajes y la letra en pantalla. Mira un ejemplo:</p>
        <VideoEjemplo />

        <section className={s.oferta}>
          <p className={s.ofertaEtiqueta}>OFERTA POR TIEMPO LIMITADO</p>
          <p className={s.precio}>{PRECIO_VIDEO}</p>
          <p className={s.ofertaTexto}>el video completo de tu canción</p>
          <p className={s.gratis}>La muestra de 20 segundos es <strong>gratis y sin compromiso</strong></p>
        </section>

        <ol className={s.pasos}>
          {PASOS.map(([n, t, d]) => (
            <li key={n} className={s.paso}>
              <span className={s.numero}>{n}</span>
              <div><p className={s.pasoTitulo}>{t}</p><p className={s.pasoTexto}>{d}</p></div>
            </li>
          ))}
        </ol>

        <Formulario whatsapp={whatsapp} />

        <p className={s.nota}>
          Las imágenes del video se crean con inteligencia artificial. Usamos tu audio y tus fotos solo para hacer tu muestra y tu video.
          Si quieres que los borremos, escríbenos por WhatsApp.
        </p>
      </div>
    </main>
  );
}
