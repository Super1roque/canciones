import type { Metadata } from 'next';
import JorgeCaballeroClient from '@/components/JorgeCaballeroClient';
import { cuesJorgeCaballero, duracionTotalSegundos } from '@/lib/jorgeCaballeroCues';

const TITULO = '🩹 50 años de servicio — Jorge Armando Caballero';
const DESCRIPCION = 'La historia de Jorge Armando Caballero, voluntario de la Cruz Roja Hondureña desde hace 50 años, narrada en voz.';

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    images: [{ url: '/jorge-caballero/miniatura.jpg', width: 1024, height: 768, type: 'image/jpeg' }],
    url: 'https://corridos.online/jorge-caballero',
    siteName: 'Canciones',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITULO,
    description: DESCRIPCION,
    images: ['/jorge-caballero/miniatura.jpg'],
  },
};

export default function JorgeCaballeroPage() {
  return (
    <JorgeCaballeroClient
      // ?v= cambia cada vez que se reemplaza el audio en Storage: la ruta se sirve como
      // immutable por un año, y sin esto los navegadores seguirían con la versión vieja.
      audioUrl="/api/jorge-caballero/audio?v=efectos"
      cues={cuesJorgeCaballero}
      duracionTotal={duracionTotalSegundos}
    />
  );
}
