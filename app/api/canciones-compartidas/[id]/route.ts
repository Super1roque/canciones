import { getDb, getStorageBucket } from '@/lib/firebaseService';
import { calcularAcceso, incrementarReproduccion } from '@/lib/cancionCompartidaService';

export const runtime = 'nodejs';

// El límite de reproducciones gratis se aplica ACÁ (no solo en la UI) —
// a partir de la reproducción MAX_ESCUCHAS_GRATIS+1, este endpoint se
// niega a servir el audio (403) si el dueño no es premium. Así el corte
// es real y no algo que se pueda evadir mirando el network tab.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const doc = await db.collection('canciones_compartidas').doc(id).get();

    if (!doc.exists) return new Response('Link no válido', { status: 404 });

    const data = doc.data()!;
    const reproducciones = data.reproducciones ?? 0;
    const { restringida } = await calcularAcceso(id, reproducciones);
    if (restringida) return new Response('Alcanzaste el límite de reproducciones gratis', { status: 403 });

    incrementarReproduccion(id);

    const bucket = getStorageBucket();
    const [buffer] = await bucket.file(data.storagePath).download();

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': data.contentType || 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('canciones-compartidas/[id]:', msg);
    return new Response('Error al reproducir el audio', { status: 500 });
  }
}
