import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { getDb } from '@/lib/firebaseService';
import { esNavegadorAdmin } from '@/lib/adminServidor';

export const runtime = 'nodejs';

// Cuenta los toques en «Compartila en tu Facebook» (para el panel: cuántos lo intentan frente a cuántas visitas llegan).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (esNavegadorAdmin(request)) return NextResponse.json({ ok: true });
  const ref = getDb().collection('canciones_compartidas').doc(id);
  if (!(await ref.get()).exists) return NextResponse.json({ error: 'Link no válido' }, { status: 404 });
  await ref.update({ compartidasFb: admin.firestore.FieldValue.increment(1) });
  return NextResponse.json({ ok: true });
}
