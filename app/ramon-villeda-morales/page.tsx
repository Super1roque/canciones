import type { Metadata } from 'next';
import InventarMiFuturoClient from '@/components/InventarMiFuturoClient';
import { cuesRamonVilledaMorales, duracionTotalSegundos } from '@/lib/ramonVilledaMoralesCues';
import { imagenesRamonVilledaMorales } from '@/lib/ramonVilledaMoralesImagenes';

// Mismo lector sincronizado que /inventar-mi-futuro — el componente recibe
// todo por props, solo cambian el audio, los cues y las fotos.
const TITULO = '📖 Siempre adelante, ni un paso atrás — Ramón Villeda Morales';
const DESCRIPCION = 'La vida de Ramón Villeda Morales, médico y presidente de Honduras (1957-1963), contada en primera persona. Un libro que se escucha.';

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    images: [{ url: '/ramon-villeda-morales/portada.jpg', width: 1200, height: 675, type: 'image/jpeg' }],
    url: 'https://corridos.online/ramon-villeda-morales',
    siteName: 'Canciones',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITULO,
    description: DESCRIPCION,
    images: ['/ramon-villeda-morales/portada.jpg'],
  },
};

export default function RamonVilledaMoralesPage() {
  return (
    <InventarMiFuturoClient
      audioUrl="/api/ramon-villeda-morales/audio"
      titulo="Siempre adelante, ni un paso atrás"
      subtitulo="Ramón Villeda Morales"
      cues={cuesRamonVilledaMorales}
      duracionTotal={duracionTotalSegundos}
      imagenes={imagenesRamonVilledaMorales}
    />
  );
}
