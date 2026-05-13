import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebaseService';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { urlCancion } = await request.json();
    const db = getDb();
    await db.collection('parodias').doc(id).update({ urlCancion: urlCancion ?? '' });
    return NextResponse.json({ id, urlCancion });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Firestore actualizarParodia:', msg);
    return NextResponse.json({ error: 'Error al actualizar la parodia' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    await db.collection('parodias').doc(id).delete();
    return NextResponse.json({ mensaje: 'Parodia eliminada correctamente' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Firestore eliminarParodia:', msg);
    return NextResponse.json({ error: 'Error al eliminar la parodia' }, { status: 500 });
  }
}
