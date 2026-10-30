import type { Metadata } from 'next';
import InventarMiFuturoClient from '@/components/InventarMiFuturoClient';
import { cuesMorazan, duracionTotalSegundos } from '@/lib/morazanCues';
import { imagenesMorazan } from '@/lib/morazanImagenes';

// Mismo lector sincronizado que /ramon-villeda-morales — el componente recibe
// todo por props, solo cambian el audio, los cues y las fotos.
const TITULO = '🎧 Morazán: entre la unión y la derrota — audiolibro gratuito';
const DESCRIPCION = 'Un homenaje a Francisco Morazán (1792-1842) de Armando Roque Godoy. Audiolibro gratuito.';
const URL = 'https://corridos.online/morazan';

const MENSAJE_COMPARTIR = `Escucha gratis el audiolibro "Morazán: entre la unión y la derrota" 🎧 ${URL}`;

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    images: [{ url: '/morazan/portada.jpg', width: 1200, height: 675, type: 'image/jpeg' }],
    url: URL,
    siteName: 'Canciones',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITULO,
    description: DESCRIPCION,
    images: ['/morazan/portada.jpg'],
  },
};

export default function MorazanPage() {
  return (
    <InventarMiFuturoClient
      // ?v= cambia cada vez que se reemplaza el audio en Storage: la ruta se sirve como
      // immutable por un año, y sin esto los navegadores seguirían con la versión vieja.
      audioUrl="/api/morazan/audio?v=podcast"
      titulo="Morazán"
      subtitulo="Entre la unión y la derrota"
      cues={cuesMorazan}
      duracionTotal={duracionTotalSegundos}
      imagenes={imagenesMorazan}
      etiqueta="Homenajes · Audiolibro gratuito"
      invitacion="Escúchalo y compártelo, sobre todo con los jóvenes"
      remate="GRATIS"
      cta={{
        texto: 'Compartir por WhatsApp',
        href: `https://wa.me/?text=${encodeURIComponent(MENSAJE_COMPARTIR)}`,
      }}
    />
  );
}
