import type { Metadata } from 'next';
import VideoGreetingClient from '@/components/VideoGreetingClient';

// Misma idea que /saludofinde y /ir: tarjeta minimalista sin descripción,
// con la misma foto + botón de play, pero apuntando a otro video.
export const metadata: Metadata = {
  title: 'corridos.online',
  description: '',
  openGraph: {
    title: 'corridos.online',
    images: [{ url: '/yavioquefaciles/og-image-vertical.jpg', width: 720, height: 1280, type: 'image/jpeg' }],
    url: 'https://corridos.online/yavioquefaciles',
    siteName: 'Canciones',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'corridos.online',
    images: ['/yavioquefaciles/og-image-vertical.jpg'],
  },
};

export default function YaVioQueFacilesPage() {
  return <VideoGreetingClient videoSrc="/yavioquefaciles/video.mp4" posterSrc="/yavioquefaciles/poster.png" />;
}
