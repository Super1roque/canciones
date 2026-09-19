import type { Metadata } from 'next';
import IrRedirectClient from './IrRedirectClient';

// Tarjeta de enlace minimalista para compartir — sin descripción, para que
// WhatsApp muestre poco más que la imagen y el dominio. No reemplaza la
// tarjeta de corridos.online (que sí tiene descripción y funciona bien);
// esta es una URL aparte para cuando se prefiera el look "solo imagen".
export const metadata: Metadata = {
  title: 'corridos.online',
  description: '',
  openGraph: {
    title: 'corridos.online',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, type: 'image/jpeg' }],
    url: 'https://corridos.online/ir',
    siteName: 'Canciones',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'corridos.online',
    images: ['/og-image.jpg'],
  },
};

export default function IrPage() {
  return <IrRedirectClient />;
}
