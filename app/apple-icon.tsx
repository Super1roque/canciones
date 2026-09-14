import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// iOS no lee el manifest.ts para el ícono de "Agregar a inicio" — necesita
// este archivo especial aparte (Next lo detecta solo y genera el
// <link rel="apple-touch-icon">).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #7a1620 0%, #4a0e14 100%)',
          fontSize: 102,
        }}
      >
        🎸
      </div>
    ),
    { ...size }
  );
}
