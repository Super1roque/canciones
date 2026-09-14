import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Ícono de instalación (Android/manifest) — mismo tema "corridos" rojo/dorado
// que usa la landing de tenants, así el ícono en el celular combina con la app.
export async function GET() {
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
          fontSize: 108,
        }}
      >
        🎸
      </div>
    ),
    { width: 192, height: 192 }
  );
}
