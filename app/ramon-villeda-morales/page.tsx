import type { Metadata } from 'next';
import InventarMiFuturoClient from '@/components/InventarMiFuturoClient';
import { cuesRamonVilledaMorales, duracionTotalSegundos } from '@/lib/ramonVilledaMoralesCues';
import { imagenesRamonVilledaMorales } from '@/lib/ramonVilledaMoralesImagenes';
import { ADMIN_WHATSAPP } from '@/lib/config';

const MENSAJE_WHATSAPP = 'He escuchado la Biografía de Ramón Villeda Morales y quiero hacer la mía';

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
      // ?v= cambia cada vez que se reemplaza el audio en Storage: la ruta se sirve como
      // immutable por un año, y sin esto los navegadores seguirían con la versión vieja.
      audioUrl="/api/ramon-villeda-morales/audio?v=efectos2"
      titulo="Siempre adelante, ni un paso atrás"
      subtitulo="Ramón Villeda Morales"
      cues={cuesRamonVilledaMorales}
      duracionTotal={duracionTotalSegundos}
      imagenes={imagenesRamonVilledaMorales}
      etiqueta="Biografías"
      invitacion="Escribe la tuya y crea tu propio libro"
      remate="Fácilmente"
      cta={{
        texto: 'Contáctame para hacer tu libro',
        href: `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(MENSAJE_WHATSAPP)}`,
      }}
    />
  );
}
