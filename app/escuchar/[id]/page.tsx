import type { Metadata } from 'next';
import { getDb } from '@/lib/firebaseService';
import AudioPlayer from './AudioPlayer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '🎵 Aquí está tu muestra de canción',
    description: 'Aquí está la prueba o muestra gratis de su canción, solo haga clic para escucharla.',
    openGraph: {
      title: '🎵 Aquí está tu muestra de canción',
      description: 'Aquí está la prueba o muestra gratis de su canción, solo haga clic para escucharla.',
      type: 'website',
    },
  };
}

export default async function EscucharPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const db  = getDb();
    const doc = await db.collection('audio_shares').doc(id).get();

    if (!doc.exists) return <InvalidLink />;

    const data = doc.data()!;
    if (data.playsLeft <= 0) return <AlreadyPlayed fileName={data.fileName} />;

    return <AudioPlayer id={id} fileName={data.fileName} />;
  } catch {
    return <InvalidLink />;
  }
}

function card(children: React.ReactNode) {
  return (
    <div style={{ minHeight: '100vh', background: '#0c0c18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', padding: '2rem' }}>{children}</div>
    </div>
  );
}

function InvalidLink() {
  return card(
    <>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
      <h1 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>Link no válido</h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>Este enlace no existe o ha expirado.</p>
    </>
  );
}

function AlreadyPlayed({ fileName }: { fileName: string }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0c0c18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, sans-serif', padding: '1.5rem' }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Estado */}
        <div style={{ background: 'rgba(239,68,68,0.06)', borderRadius: 16, padding: '2.5rem', border: '1px solid rgba(239,68,68,0.25)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔒</div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>Audio ya escuchado</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem' }}>&quot;{fileName}&quot;</p>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', marginTop: '0.4rem' }}>Ya agotó la prueba gratis, ya no podrá escuchar más este audio, contáctenos para enviárselo de nuevo.</p>
        </div>

        {/* CTA de pago */}
        <div style={{
          background: 'linear-gradient(135deg, #1a1030, #0c0c18)',
          borderRadius: 16, padding: '2rem 1.5rem',
          border: '2px solid #f97316',
          boxShadow: '0 0 24px rgba(249,115,22,0.2)',
        }}>
          <p style={{
            fontSize: '1rem', fontWeight: 800, color: '#f97316',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            lineHeight: 1.4, marginBottom: '1.25rem',
          }}>
            🎵 Para obtener esta canción en audio y video haga el depósito respectivo de:
          </p>

          <div style={{
            background: 'rgba(249,115,22,0.12)', borderRadius: 10,
            padding: '0.75rem 1rem', marginBottom: '1.25rem',
            border: '1px solid rgba(249,115,22,0.3)',
          }}>
            <p style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff' }}>500 Lempiras</p>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>ó  20 USD americanos</p>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>
            A la siguiente cuenta:
          </p>

          <div style={{
            background: 'rgba(255,255,255,0.06)', borderRadius: 10,
            padding: '1rem 1.25rem', border: '1px solid rgba(255,255,255,0.12)',
          }}>
            <p style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginBottom: '0.3rem' }}>🏦 Banco Atlántida</p>
            <p style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f97316', letterSpacing: '0.1em', fontFamily: 'monospace' }}>
              14720926485
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
