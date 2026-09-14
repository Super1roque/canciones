import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Canciones — Corridos a tu medida',
    short_name: 'Canciones',
    description: 'Contanos tu historia y te la convertimos en la parodia de tu corrido favorito.',
    start_url: '/',
    display: 'standalone',
    background_color: '#4a0e14',
    theme_color: '#7a1620',
    icons: [
      { src: '/pwa-icon-192', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-icon-512', sizes: '512x512', type: 'image/png' },
    ],
  };
}
