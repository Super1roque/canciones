import type { Metadata } from 'next';
import SaludoFindeClient from './SaludoFindeClient';

// Tarjeta minimalista para compartir por WhatsApp — misma idea que /ir:
// sin descripción, con una imagen armada a mano (la foto + un botón de
// play superpuesto, simulando una miniatura de video) para que al abrir
// el link se vea la tarjeta y, adentro, el video de verdad.
export const metadata: Metadata = {
  title: 'corridos.online',
  description: '',
  openGraph: {
    title: 'corridos.online',
    images: [{ url: '/saludofinde/og-image.jpg', width: 1200, height: 630, type: 'image/jpeg' }],
    url: 'https://corridos.online/saludofinde',
    siteName: 'Canciones',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'corridos.online',
    images: ['/saludofinde/og-image.jpg'],
  },
};

export default function SaludoFindePage() {
  return <SaludoFindeClient />;
}
