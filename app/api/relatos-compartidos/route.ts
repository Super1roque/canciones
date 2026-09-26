import { NextResponse } from 'next/server';
import { getDb, getStorageBucket } from '@/lib/firebaseService';

export const runtime = 'nodejs';
export const maxDuration = 60;

// El audio y las cues ya vienen listos desde /admin/leer-relato (ya se
// generaron y transcribieron ahí) — acá solo se guardan para poder
// reproducirlos después desde un link, sin volver a llamar a Deepgram.
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const cuesRaw = (formData.get('cues') as string | null) ?? '';
    const voz = (formData.get('voz') as string | null)?.trim();
    const titulo = (formData.get('titulo') as string | null)?.trim();

    if (!file) return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    if (!voz) return NextResponse.json({ error: 'Falta la voz' }, { status: 400 });
    if (!titulo) return NextResponse.json({ error: 'Falta el título del relato' }, { status: 400 });

    let cues: unknown;
    try {
      cues = JSON.parse(cuesRaw);
    } catch {
      return NextResponse.json({ error: 'Las cues no son un JSON válido' }, { status: 400 });
    }
    if (!Array.isArray(cues) || cues.length === 0) {
      return NextResponse.json({ error: 'Faltan las cues del relato' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const id = crypto.randomUUID();
    const storagePath = `relatos-compartidos/${id}`;

    await getStorageBucket().file(storagePath).save(buffer, {
      metadata: { contentType: file.type || 'audio/mpeg' },
    });

    const db = getDb();
    await db.collection('relatos_compartidos').doc(id).set({
      titulo,
      voz,
      storagePath,
      contentType: file.type || 'audio/mpeg',
      cues,
      fecha: new Date().toISOString(),
      reproducciones: 0,
    });

    return NextResponse.json({ id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('relatos-compartidos POST:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
