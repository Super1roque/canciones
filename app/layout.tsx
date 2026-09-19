import type { Metadata, Viewport } from 'next';
import RegisterServiceWorker from '@/components/RegisterServiceWorker';
import MetaPixel from '@/components/MetaPixel';
import './globals.css';

const TITULO = 'Canciones — Generador de Parodias';
const DESCRIPCION = 'Contanos tu historia y te la convertimos en la parodia de tu corrido favorito. Tu primera canción es gratis.';

export const metadata: Metadata = {
  metadataBase: new URL('https://corridos.online'),
  title: TITULO,
  description: DESCRIPCION,
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Canciones' },
  // Verifica la propiedad de corridos.online en Meta Business Manager —
  // necesario para configurar Aggregated Event Measurement del pixel.
  other: { 'facebook-domain-verification': '59gfvlrirtps27o5qgrigzgknsw70n' },
  // Tarjeta que arma WhatsApp (y Facebook/Twitter) al compartir el link —
  // es lo más parecido a un "dibujo clickeable": la imagen + texto quedan
  // como una sola tarjeta tocable que abre corridos.online.
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    url: 'https://corridos.online',
    siteName: 'Canciones',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    locale: 'es_HN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITULO,
    description: DESCRIPCION,
    images: ['/og-image.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#7a1620',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <RegisterServiceWorker />
        <MetaPixel />
      </body>
    </html>
  );
}
