import localFont from 'next/font/local';

// Fuentes guardadas en el proyecto (subconjunto latin, bajadas de Google Fonts el 17 nov 2026). Antes se usaba
// next/font/google, que las descarga en cada build: el 17 nov 2026 dos deploys en Render fallaron porque Google no
// respondió. Baloo 2 y Literata son variables: un solo archivo cubre todos los pesos.
export const baloo = localFont({ src: './baloo-2.woff2', weight: '400 800', display: 'swap' });
export const literata = localFont({ src: './literata.woff2', weight: '200 900', display: 'swap' });
export const rye = localFont({ src: './rye.woff2', weight: '400', display: 'swap', variable: '--font-corrido' });
