import type { Metadata } from 'next';
import { getDb } from '@/lib/firebaseService';
import RelatoPublicoClient from '@/components/RelatoPublicoClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Cue = { start: number; end: number; text: string };

async function obtenerRelato(id: string) {
  const db = getDb();
  const doc = await db.collection('relatos_compartidos').doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as { cues: Cue[] };
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: '📖 Relato — corridos.online', description: '' };
}

export default async function RelatoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const relato = await obtenerRelato(id);

  if (!relato) {
    return (
      <main style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#141210', color: '#f2ede6', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '1.5rem',
      }}>
        <div>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔗</div>
          <p>Este enlace no existe o ya no está disponible.</p>
        </div>
      </main>
    );
  }

  return <RelatoPublicoClient audioApiUrl={`/api/relatos-compartidos/${id}`} cues={relato.cues} />;
}
