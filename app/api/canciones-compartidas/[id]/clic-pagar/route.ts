import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { getDb } from '@/lib/firebaseService';
import { esNavegadorAdmin } from '@/lib/adminServidor';

export const runtime = 'nodejs';

// Cuenta cuántas veces se abrió «Pagar L 250» en la página de la canción: con eso el panel muestra si la gente
// quiere pagar y se traba en el pago, o si ni siquiera llega al botón. Los toques del admin no cuentan.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (esNavegadorAdmin(request)) return NextResponse.json({ ok: true });
  const ref = getDb().collection('canciones_compartidas').doc(id);
  if (!(await ref.get()).exists) return NextResponse.json({ error: 'Link no válido' }, { status: 404 });
  await ref.update({ clicsPagar: admin.firestore.FieldValue.increment(1) });
  return NextResponse.json({ ok: true });
}
