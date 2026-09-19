import type { Metadata } from 'next';
import VideoGreetingClient from '@/components/VideoGreetingClient';

// Tarjeta minimalista para compartir por WhatsApp — misma idea que /ir:
// sin descripción, con una imagen armada a mano (la foto + un botón de
// play superpuesto, simulando una miniatura de video) para que al abrir
// el link se vea la tarjeta y, adentro, el video de verdad.
export const metadata: Metadata = {
  title: 'corridos.online',
  description: '',
  openGraph: {
    title: 'corridos.online',
    // Vertical (9:16) en vez del 1200x630 horizontal habitual — hace juego
    // con el video real, que también es vertical (celular).
    images: [{ url: '/saludofinde/og-image-vertical.jpg', width: 720, height: 1280, type: 'image/jpeg' }],
    url: 'https://corridos.online/saludofinde',
    siteName: 'Canciones',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'corridos.online',
    images: ['/saludofinde/og-image-vertical.jpg'],
  },
};

export default function SaludoFindePage() {
  return <VideoGreetingClient videoSrc="/saludofinde/video.mp4" posterSrc="/saludofinde/poster.png" />;
}
