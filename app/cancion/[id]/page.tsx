import type { Metadata } from 'next';
import { getDb } from '@/lib/firebaseService';
import type { Cue } from '@/lib/deepgramService';
import AudioGreetingClient from '@/components/AudioGreetingClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function obtenerCancion(id: string) {
  const db = getDb();
  const doc = await db.collection('canciones_compartidas').doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as { titulo: string; cues?: Cue[] };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const cancion = await obtenerCancion(id);
  const titulo = cancion ? `🎵 ${cancion.titulo}` : 'corridos.online';

  // Tarjeta minimalista, sin descripción — misma idea que /ir y /saludofinde.
  return {
    title: titulo,
    description: '',
    openGraph: {
      title: titulo,
      images: [{ url: '/cancion-compartida/og-image-vertical.jpg', width: 720, height: 1280, type: 'image/jpeg' }],
      url: `https://corridos.online/cancion/${id}`,
      siteName: 'Canciones',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: titulo,
      images: ['/cancion-compartida/og-image-vertical.jpg'],
    },
  };
}

export default async function CancionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cancion = await obtenerCancion(id);

  if (!cancion) {
    return (
      <main style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#5c0f18', color: '#fdf3e0', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '1.5rem',
      }}>
        <div>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔗</div>
          <p>Este enlace no existe o ya no está disponible.</p>
        </div>
      </main>
    );
  }

  return (
    <AudioGreetingClient
      audioApiUrl={`/api/canciones-compartidas/${id}`}
      posterSrc="/cancion-compartida/poster.png"
      titulo={cancion.titulo}
      cues={cancion.cues}
    />
  );
}
