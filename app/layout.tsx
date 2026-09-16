import type { Metadata, Viewport } from 'next';
import RegisterServiceWorker from '@/components/RegisterServiceWorker';
import MetaPixel from '@/components/MetaPixel';
import './globals.css';

export const metadata: Metadata = {
  title: 'Canciones — Generador de Parodias',
  description: 'Generador de parodias de canciones con IA',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Canciones' },
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
