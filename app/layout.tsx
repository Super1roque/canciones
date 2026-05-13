import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Canciones — Generador de Parodias',
  description: 'Generador de parodias de canciones con IA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
