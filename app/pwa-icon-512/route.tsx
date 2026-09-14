import { ImageResponse } from 'next/og';

export const runtime = 'edge';

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
          fontSize: 290,
        }}
      >
        🎸
      </div>
    ),
    { width: 512, height: 512 }
  );
}
