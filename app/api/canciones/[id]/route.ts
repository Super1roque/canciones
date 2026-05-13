import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebaseService';

const COLLECTION = 'canciones';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const doc = await db.collection(COLLECTION).doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Canción no encontrada' }, { status: 404 });
    }
    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Firestore obtenerCancion:', msg);
    return NextResponse.json({ error: 'Error al obtener la canción' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { nombre, estilo, descripcionEstilo, direccionGenerador, letra } = await request.json();

    if (!nombre || !estilo || !letra) {
      return NextResponse.json(
        { error: 'Los campos nombre, estilo y letra son obligatorios' },
        { status: 400 }
      );
    }

    const db = getDb();
    const ref = db.collection(COLLECTION).doc(id);
    const doc = await ref.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Canción no encontrada' }, { status: 404 });
    }

    await ref.update({
      nombre: nombre.trim(),
      estilo: estilo.trim(),
      descripcionEstilo: descripcionEstilo?.trim() ?? '',
      direccionGenerador: direccionGenerador?.trim() ?? '',
      letra: letra.trim(),
    });

    return NextResponse.json({ id, nombre, estilo, descripcionEstilo, direccionGenerador, letra });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Firestore editarCancion:', msg);
    return NextResponse.json({ error: 'Error al editar la canción' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const ref = db.collection(COLLECTION).doc(id);
    const doc = await ref.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Canción no encontrada' }, { status: 404 });
    }

    await ref.delete();
    return NextResponse.json({ mensaje: 'Canción eliminada correctamente' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Firestore eliminarCancion:', msg);
    return NextResponse.json({ error: 'Error al eliminar la canción' }, { status: 500 });
  }
}
