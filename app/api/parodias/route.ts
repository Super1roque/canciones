import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebaseService';

export async function GET() {
  try {
    const db = getDb();
    const snapshot = await db.collection('parodias').orderBy('fecha', 'desc').get();
    const parodias = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(parodias);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Firestore listarParodias:', msg);
    return NextResponse.json({ error: 'Error al leer las parodias' }, { status: 500 });
  }
}
