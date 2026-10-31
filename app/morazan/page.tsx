import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import InventarMiFuturoClient from '@/components/InventarMiFuturoClient';
import AccesoMorazan from '@/components/AccesoMorazan';
import { cuesMorazan, duracionTotalSegundos } from '@/lib/morazanCues';
import type { CuePárrafo } from '@/lib/inventarMiFuturoCues';
import { imagenesMorazan } from '@/lib/morazanImagenes';
import { checkoutMorazan, COOKIE_MORAZAN, tokenValido } from '@/lib/accesoAudiolibros';

// Mismo lector sincronizado que /ramon-villeda-morales — el componente recibe
// todo por props, solo cambian el audio, los cues y las fotos.
//
// Venta en Hotmart: cuando MORAZAN_HOTMART_CHECKOUT está configurado, quien no compró
// escucha la muestra (hasta el capítulo 1) y al final ve el botón de compra; quien compró
// tiene la cookie de acceso y escucha el libro completo. Sin esa variable, todo es gratis.
const URL = 'https://corridos.online/morazan';
// Último cue de la muestra (fin del capítulo 1) y duración de morazan/muestra.mp3.
const ULTIMO_CUE_MUESTRA = 26;
const DURACION_MUESTRA = 396.1;
// La muestra termina con un aviso hablado (voz del narrador, después de la cortina de guitarra):
// quien la escucha en el carro no ve la pantalla y, sin esto, parecía que el audio se había cortado.
const AVISO_FIN_MUESTRA: CuePárrafo[] = [
  { start: 358.1, end: 363.54, text: 'Aquí termina la muestra gratuita de «Morazán: entre la unión y la derrota».', kind: 'heading' },
  {
    start: 363.6,
    end: 372.38,
    text: 'Si quieres seguir escuchando, te esperan ocho capítulos más, el epílogo y el podcast «Más allá del mito»: casi una hora de historia.',
    kind: 'p',
  },
  {
    start: 372.46,
    end: 388.02,
    text: 'Cuando puedas, sin estar manejando, entra a corridos.online/morazan y toca el botón «Escuchar el libro completo». Es un solo pago de US$ 4.99, y el libro queda tuyo para siempre.',
    kind: 'p',
  },
  { start: 388.08, end: 389.3, text: 'Gracias por escuchar.', kind: 'p' },
];

export async function generateMetadata(): Promise<Metadata> {
  const enVenta = !!checkoutMorazan();
  const titulo = enVenta
    ? '🎧 Morazán: entre la unión y la derrota — audiolibro'
    : '🎧 Morazán: entre la unión y la derrota — audiolibro gratuito';
  const descripcion = enVenta
    ? 'Un homenaje a Francisco Morazán (1792-1842) de Armando Roque Godoy. Escucha gratis el primer capítulo.'
    : 'Un homenaje a Francisco Morazán (1792-1842) de Armando Roque Godoy. Audiolibro gratuito.';
  const imagen = enVenta ? '/morazan/portada-venta.jpg' : '/morazan/portada.jpg';
  return {
    title: titulo,
    description: descripcion,
    openGraph: {
      title: titulo,
      description: descripcion,
      images: [{ url: imagen, width: 1200, height: 675, type: 'image/jpeg' }],
      url: URL,
      siteName: 'Canciones',
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: titulo, description: descripcion, images: [imagen] },
  };
}

export default async function MorazanPage({ searchParams }: { searchParams: Promise<{ compra?: string }> }) {
  const checkout = checkoutMorazan();
  // Hotmart devuelve al comprador a /morazan?compra=ok: ahí no se le vuelve a ofrecer la compra.
  const recienCompro = (await searchParams).compra === 'ok';
  const compro = checkout
    ? await tokenValido('morazan', (await cookies()).get(COOKIE_MORAZAN)?.value)
    : false;

  if (checkout && !compro) {
    return (
      <InventarMiFuturoClient
        audioUrl="/api/morazan/audio?parte=muestra&v=2"
        titulo="Morazán"
        subtitulo="Entre la unión y la derrota"
        cues={[...cuesMorazan.slice(0, ULTIMO_CUE_MUESTRA + 1), ...AVISO_FIN_MUESTRA]}
        duracionTotal={DURACION_MUESTRA}
        imagenes={imagenesMorazan.filter((img) => img.afterCueIdx <= ULTIMO_CUE_MUESTRA)}
        etiqueta="Homenajes · Primer capítulo gratis"
        firma="🎧 ¿Te gustó el primer capítulo?"
        invitacion="Siguen ocho capítulos, el epílogo y el podcast «Más allá del mito»"
        remate="casi una hora de audio"
        cta={
          recienCompro
            ? { texto: '🎧 Abrir mi libro completo', href: '#acceso' }
            : { texto: '🎧 Escuchar el libro completo', href: checkout }
        }
        pie={<AccesoMorazan key="acceso" />}
      />
    );
  }

  const mensajeCompartir = checkout
    ? `Escucha gratis el primer capítulo del audiolibro "Morazán: entre la unión y la derrota" 🎧 ${URL}`
    : `Escucha gratis el audiolibro "Morazán: entre la unión y la derrota" 🎧 ${URL}`;
  return (
    <InventarMiFuturoClient
      // ?v= cambia cada vez que se reemplaza el audio en Storage: la ruta se sirve como
      // immutable por un año, y sin esto los navegadores seguirían con la versión vieja.
      audioUrl={checkout ? '/api/morazan/audio?v=venta' : '/api/morazan/audio?v=podcast'}
      titulo="Morazán"
      subtitulo="Entre la unión y la derrota"
      cues={cuesMorazan}
      duracionTotal={duracionTotalSegundos}
      imagenes={imagenesMorazan}
      etiqueta={checkout ? 'Homenajes · Audiolibro' : 'Homenajes · Audiolibro gratuito'}
      firma="🇭🇳 Gracias por escuchar a Morazán"
      invitacion={checkout ? 'Comparte el primer capítulo, sobre todo con los jóvenes' : 'Escúchalo y compártelo, sobre todo con los jóvenes'}
      remate={checkout ? 'es gratis' : 'GRATIS'}
      cta={{
        texto: 'Compartir por WhatsApp',
        href: `https://wa.me/?text=${encodeURIComponent(mensajeCompartir)}`,
      }}
    />
  );
}
