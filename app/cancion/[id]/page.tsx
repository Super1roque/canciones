import type { Metadata } from 'next';
import { cookies } from 'next/headers';
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

// El mensaje sigue hablando de "3 días" a propósito — es más fácil de
// entender para el tenant que un número de horas raro, aunque el corte
// real sea antes.
const HORAS_GRATIS = 60;

// El gratis-por-3-días es para el dueño de la canción (quien la pidió),
// no para cualquiera que reciba el link — por eso se resuelve vía el
// pedido vinculado, no por la sesión de quien esté mirando la página.
// Las subidas sueltas (sin pedido, ej. /admin/compartir-cancion) no tienen
// dueño y quedan sin restricción ni límite de descarga.
//
// `restringida` y `descargable` son cosas distintas a propósito: la
// escucha es gratis durante las primeras horas (HORAS_GRATIS) aunque el dueño no sea
// premium, pero la descarga es un privilegio exclusivo de premium sin
// importar la edad de la canción — antes ambas dependían de la misma
// bandera y una canción recién subida de un tenant freemium terminaba
// mostrando igual el botón de descargar.
// `esDueño` decide QUÉ mensaje ve quien se topa con el corte — el dueño ve
// la invitación a recargar; cualquier otra persona (a quien le reenviaron
// el link) ve un mensaje genérico que no expone que el dueño es freemium
// ni lo invita a él a pagar. El corte en sí (restringida) aplica igual
// para todos — si dependiera de que el dueño esté logueado en ESE
// navegador para activarse, alcanzaría con no iniciar sesión ahí para
// evadirlo.
async function obtenerAccesoCancion(id: string, fechaCancion: string): Promise<{ restringida: boolean; descargable: boolean; esDueño: boolean }> {
  const db = getDb();
  const pedidosSnap = await db.collection('pedidos').where('cancionCompartidaId', '==', id).limit(1).get();
  if (pedidosSnap.empty) return { restringida: false, descargable: true, esDueño: false };

  const telefono = pedidosSnap.docs[0].data().telefono as string;
  const tenantDoc = await db.collection('tenants').doc(telefono).get();
  const premium = tenantDoc.exists && tenantDoc.data()?.plan === 'premium';

  const cookieStore = await cookies();
  const esDueño = cookieStore.get('tenant_phone')?.value === telefono;

  const edadHoras = (Date.now() - new Date(fechaCancion).getTime()) / (1000 * 60 * 60);
  return {
    restringida: !premium && edadHoras > HORAS_GRATIS,
    descargable: premium,
    esDueño,
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

  const { restringida, descargable, esDueño } = await obtenerAccesoCancion(id, cancion.fecha);

  return (
    <AudioGreetingClient
      audioApiUrl={`/api/canciones-compartidas/${id}`}
      posterSrc="/cancion-compartida/poster.png"
      titulo={cancion.titulo}
      cues={cancion.cues}
      restringida={restringida}
      descargable={descargable}
      esDueño={esDueño}
    />
  );
}
