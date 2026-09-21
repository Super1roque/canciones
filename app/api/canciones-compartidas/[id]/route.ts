import { getDb, getStorageBucket } from '@/lib/firebaseService';
import { incrementarReproduccion } from '@/lib/cancionCompartidaService';

export const runtime = 'nodejs';

// A diferencia de /api/audio/[id] (el teaser de pago), acá no hay
// transacción de conteo para bloquear reproducciones, ni recorte con
// ffmpeg, ni borrado del archivo — se puede escuchar cuantas veces haga
// falta, a propósito, porque el objetivo es que el link circule. El
// contador de `incrementarReproduccion` es solo para medir viralización,
// no para limitar nada.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const doc = await db.collection('canciones_compartidas').doc(id).get();

    if (!doc.exists) return new Response('Link no válido', { status: 404 });
    incrementarReproduccion(id);

    const data = doc.data()!;
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
