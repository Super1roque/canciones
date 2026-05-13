import { getDb, getStorageBucket } from '@/lib/firebaseService';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db      = getDb();
    const docRef  = db.collection('audio_shares').doc(id);

    let storagePath = '';
    let contentType = 'audio/mpeg';

    try {
      await db.runTransaction(async (tx) => {
        const doc = await tx.get(docRef);
        if (!doc.exists)  throw new Error('NOT_FOUND');
        const data = doc.data()!;
        if (data.played)  throw new Error('ALREADY_PLAYED');
        tx.update(docRef, { played: true, playedAt: new Date().toISOString() });
        storagePath = data.storagePath;
        contentType = data.contentType || 'audio/mpeg';
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'NOT_FOUND')      return new Response('Link no válido',          { status: 404 });
      if (msg === 'ALREADY_PLAYED') return new Response('Audio ya fue escuchado',  { status: 403 });
      throw e;
    }

    const bucket = getStorageBucket();
    const [buffer] = await bucket.file(storagePath).download();

    // Delete from Storage after serving — no longer needed
    await bucket.file(storagePath).delete().catch(() => {});

    return new Response(buffer, {
      headers: {
        'Content-Type':   contentType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control':  'no-store',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('audio/[id]:', msg);
    return new Response('Error al reproducir el audio', { status: 500 });
  }
}
