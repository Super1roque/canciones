import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebaseService';

const COLLECTION = 'canciones';

export async function GET() {
  try {
    const db = getDb();
    const snapshot = await db.collection(COLLECTION).orderBy('nombre').get();
    const canciones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(canciones);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Firestore listarCanciones:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { nombre, estilo, descripcionEstilo, direccionGenerador, letra } = await request.json();

    if (!nombre || !estilo || !letra) {
      return NextResponse.json(
        { error: 'Los campos nombre, estilo y letra son obligatorios' },
        { status: 400 }
      );
    }

    const db = getDb();
    const docRef = await db.collection(COLLECTION).add({
      nombre: nombre.trim(),
      estilo: estilo.trim(),
      descripcionEstilo: descripcionEstilo?.trim() ?? '',
      direccionGenerador: direccionGenerador?.trim() ?? '',
      letra: letra.trim(),
    });

    return NextResponse.json({ id: docRef.id, nombre, estilo, descripcionEstilo, direccionGenerador, letra }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Firestore agregarCancion:', msg);
    return NextResponse.json({ error: 'Error al agregar la canción' }, { status: 500 });
  }
}
