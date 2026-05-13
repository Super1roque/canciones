import { getDb } from '@/lib/firebaseService';
import AudioPlayer from './AudioPlayer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function EscucharPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const db  = getDb();
    const doc = await db.collection('audio_shares').doc(id).get();

    if (!doc.exists) return <InvalidLink />;

    const data = doc.data()!;
    if (data.played) return <AlreadyPlayed fileName={data.fileName} />;

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
  return card(
    <>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
      <h1 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>Audio ya escuchado</h1>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem' }}>&quot;{fileName}&quot;</p>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', marginTop: '0.4rem' }}>Este audio solo podía escucharse una vez.</p>
    </>
  );
}
