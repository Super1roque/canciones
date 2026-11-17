import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { getDb } from '@/lib/firebaseService';
import { esNavegadorAdmin } from '@/lib/adminServidor';

export const runtime = 'nodejs';

// Descarga gratis por unirse al canal de WhatsApp (ver lib/pagoDescarga.ts). `paso: 'clic'` cuenta el toque en
// «Unirme al canal»; `paso: 'unido'` (al volver a la página) habilita la descarga. Solo se habilita si antes tocó
// el botón. Los toques del admin no cuentan ni habilitan nada.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { paso } = await request.json().catch(() => ({}));
  if (paso !== 'clic' && paso !== 'unido') return NextResponse.json({ error: 'Paso no válido' }, { status: 400 });
  const ref = getDb().collection('canciones_compartidas').doc(id);
  const doc = await ref.get();
  if (!doc.exists) return NextResponse.json({ error: 'Link no válido' }, { status: 404 });
  if (esNavegadorAdmin(request)) return NextResponse.json({ ok: true });

  if (paso === 'clic') {
    await ref.update({ clicsCanal: admin.firestore.FieldValue.increment(1), ultimoClicCanal: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  }
  if (!doc.get('clicsCanal')) return NextResponse.json({ error: 'Primero tocá «Unirme al canal»' }, { status: 409 });
  if (doc.get('descargaHabilitada') !== true) {
    await ref.update({ descargaHabilitada: true, desbloqueadaPor: 'canal', unidoCanalEn: new Date().toISOString() });
  }
  return NextResponse.json({ ok: true, descargable: true });
}
