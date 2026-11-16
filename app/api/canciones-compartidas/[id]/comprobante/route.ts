import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { getDb, getStorageBucket } from '@/lib/firebaseService';
import { MAX_COMPROBANTES, MAX_COMPROBANTE_BYTES } from '@/lib/pagoDescarga';
import { avisarComprobanteAdmin } from '@/lib/pushService';

export const runtime = 'nodejs';

// La persona sube la foto del comprobante de la transferencia (L 250) desde la página de la canción. Se guarda
// junto a la canción y se le avisa al admin; la descarga se habilita cuando él lo revisa en /admin/pedidos.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const db = getDb();
    const ref = db.collection('canciones_compartidas').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: 'Link no válido' }, { status: 404 });
    if (doc.get('descargaHabilitada') === true) return NextResponse.json({ ok: true, yaHabilitada: true });
    if ((doc.get('comprobantes')?.length ?? 0) >= MAX_COMPROBANTES) {
      return NextResponse.json({ error: 'Ya recibimos tus comprobantes. Escribinos por WhatsApp si necesitás ayuda.' }, { status: 429 });
    }

    const file = (await request.formData()).get('imagen') as File | null;
    if (!file || !file.type.startsWith('image/')) return NextResponse.json({ error: 'Subí una foto del comprobante' }, { status: 400 });
    if (file.size > MAX_COMPROBANTE_BYTES) return NextResponse.json({ error: 'La foto supera el límite de 8 MB' }, { status: 400 });

    const path = `comprobantes/${id}/${crypto.randomUUID()}`;
    await getStorageBucket().file(path).save(Buffer.from(await file.arrayBuffer()), { metadata: { contentType: file.type } });
    await ref.update({
      comprobantes: admin.firestore.FieldValue.arrayUnion({ path, contentType: file.type, fecha: new Date().toISOString() }),
    });

    const pedido = await db.collection('pedidos').where('cancionCompartidaId', '==', id).limit(1).get();
    void avisarComprobanteAdmin(doc.get('titulo'), pedido.empty ? undefined : pedido.docs[0].get('telefono'));
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('canciones-compartidas/comprobante:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se pudo subir el comprobante, intentá de nuevo' }, { status: 500 });
  }
}
