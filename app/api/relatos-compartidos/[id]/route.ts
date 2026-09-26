import { getDb, getStorageBucket } from '@/lib/firebaseService';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const doc = await db.collection('relatos_compartidos').doc(id).get();

    if (!doc.exists) return new Response('Link no válido', { status: 404 });

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
    console.error('relatos-compartidos/[id]:', msg);
    return new Response('Error al reproducir el audio', { status: 500 });
  }
}
