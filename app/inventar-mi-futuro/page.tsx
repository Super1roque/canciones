import type { Metadata } from 'next';
import InventarMiFuturoClient from '@/components/InventarMiFuturoClient';
import { cuesInventarMiFuturo, duracionTotalSegundos } from '@/lib/inventarMiFuturoCues';
import { imagenesInventarMiFuturo } from '@/lib/inventarMiFuturoImagenes';

export const metadata: Metadata = {
  title: '📖 Inventar mi futuro — Armando Roque Godoy',
  description: 'Las memorias de Armando Roque Godoy, narradas en su propia voz. Un libro que se escucha.',
  openGraph: {
    title: '📖 Inventar mi futuro — Armando Roque Godoy',
    description: 'Las memorias de Armando Roque Godoy, narradas en su propia voz. Un libro que se escucha.',
    images: [{ url: '/inventar-mi-futuro/portada.jpg', width: 1097, height: 1520, type: 'image/jpeg' }],
    url: 'https://corridos.online/inventar-mi-futuro',
    siteName: 'Canciones',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '📖 Inventar mi futuro — Armando Roque Godoy',
    description: 'Las memorias de Armando Roque Godoy, narradas en su propia voz. Un libro que se escucha.',
    images: ['/inventar-mi-futuro/portada.jpg'],
  },
};

export default function InventarMiFuturoPage() {
  return (
    <InventarMiFuturoClient
      // ?v= cambia cada vez que se reemplaza el audio en Storage: la ruta se sirve como
      // immutable por un año, y sin esto los navegadores seguirían con la versión vieja.
      audioUrl="/api/inventar-mi-futuro/audio?v=foley"
      titulo="Inventar mi futuro"
      subtitulo="Memorias de quien rompió el molde"
      cues={cuesInventarMiFuturo}
      duracionTotal={duracionTotalSegundos}
      imagenes={imagenesInventarMiFuturo}
    />
  );
}
