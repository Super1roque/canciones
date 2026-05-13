import { NextResponse } from 'next/server';
import { getDb, getStorageBucket } from '@/lib/firebaseService';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    if (!file.type.startsWith('audio/')) return NextResponse.json({ error: 'El archivo debe ser audio' }, { status: 400 });
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'El archivo supera el límite de 4 MB' }, { status: 400 });

    const buffer      = Buffer.from(await file.arrayBuffer());
    const id          = crypto.randomUUID();
    const storagePath = `audio/${id}`;

    const bucket = getStorageBucket();
    await bucket.file(storagePath).save(buffer, {
      metadata: { contentType: file.type || 'audio/mpeg' },
    });

    const db = getDb();
    await db.collection('audio_shares').doc(id).set({
      fileName:    file.name,
      storagePath,
      contentType: file.type || 'audio/mpeg',
      size:        buffer.length,
      played:      false,
      createdAt:   new Date().toISOString(),
    });

    return NextResponse.json({ id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('audio/upload:', msg);
    return NextResponse.json({ error: 'Error al subir el archivo' }, { status: 500 });
  }
}
