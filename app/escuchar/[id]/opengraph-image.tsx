import { ImageResponse } from 'next/og';

export const runtime     = 'edge';
export const alt         = 'Muestra de canción';
export const size        = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%',
          background: 'linear-gradient(135deg, #0c0c18 0%, #1a1030 100%)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: 'sans-serif', color: 'white',
          padding: '60px',
        }}
      >
        {/* Music icon */}
        <div style={{ fontSize: 96, marginBottom: 32, display: 'flex' }}>♪</div>

        {/* Title */}
        <div style={{
          fontSize: 56, fontWeight: 900, textAlign: 'center',
          marginBottom: 20, lineHeight: 1.2,
          color: 'white',
        }}>
          Aquí está tu muestra de canción
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: 30, color: 'rgba(255,255,255,0.65)',
          textAlign: 'center', lineHeight: 1.5, marginBottom: 52,
          maxWidth: 800,
        }}>
          Solo haz clic para escucharla — disponible una sola vez
        </div>

        {/* CTA button */}
        <div style={{
          background: '#f97316', borderRadius: 60,
          padding: '18px 60px', fontSize: 32, fontWeight: 800,
          color: 'white', display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <span>▶</span>
          <span>Escuchar ahora</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
