import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { getDb } from '@/lib/firebaseService';

export const runtime = 'nodejs';

// La página avisa aquí la primera pausa automática de cada escucha: así el panel muestra cuántas
// escuchas salieron con pausas. Una por escucha, no por pausa; las del admin no llegan aquí.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ref = getDb().collection('canciones_compartidas').doc(id);
  const doc = await ref.get();
  if (!doc.exists) return NextResponse.json({ error: 'Link no válido' }, { status: 404 });
  await ref.update({ escuchasConPausa: admin.firestore.FieldValue.increment(1) });
  return NextResponse.json({ ok: true });
}
