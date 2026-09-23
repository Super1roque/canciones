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
  return doc.data() as { titulo: string; cues?: Cue[]; fecha: string };
}

const HORAS_GRATIS = 72;

// El gratis-por-3-días es para el dueño de la canción (quien la pidió),
// no para cualquiera que reciba el link — por eso se resuelve vía el
// pedido vinculado, no por la sesión de quien esté mirando la página.
// Las subidas sueltas (sin pedido, ej. /admin/compartir-cancion) no tienen
// dueño y quedan sin restricción ni límite de descarga.
//
// `restringida` y `descargable` son cosas distintas a propósito: la
// escucha es gratis durante las primeras 72h aunque el dueño no sea
// premium, pero la descarga es un privilegio exclusivo de premium sin
// importar la edad de la canción — antes ambas dependían de la misma
// bandera y una canción recién subida de un tenant freemium terminaba
// mostrando igual el botón de descargar.
async function obtenerAccesoCancion(id: string, fechaCancion: string): Promise<{ restringida: boolean; descargable: boolean }> {
  const db = getDb();
  const pedidosSnap = await db.collection('pedidos').where('cancionCompartidaId', '==', id).limit(1).get();
  if (pedidosSnap.empty) return { restringida: false, descargable: true };

  const telefono = pedidosSnap.docs[0].data().telefono as string;
  const tenantDoc = await db.collection('tenants').doc(telefono).get();
  const premium = tenantDoc.exists && tenantDoc.data()?.plan === 'premium';

  const edadHoras = (Date.now() - new Date(fechaCancion).getTime()) / (1000 * 60 * 60);
  return {
    restringida: !premium && edadHoras > HORAS_GRATIS,
    descargable: premium,
  };
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

  const { restringida, descargable } = await obtenerAccesoCancion(id, cancion.fecha);

  return (
    <AudioGreetingClient
      audioApiUrl={`/api/canciones-compartidas/${id}`}
      posterSrc="/cancion-compartida/poster.png"
      titulo={cancion.titulo}
      cues={cancion.cues}
      restringida={restringida}
      descargable={descargable}
    />
  );
}
