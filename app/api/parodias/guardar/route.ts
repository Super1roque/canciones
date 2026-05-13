import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebaseService';

export async function POST(request: Request) {
  try {
    const { cancion_base, estilo, descripcionEstilo, direccionGenerador, historia, parodia } = await request.json();

    if (!cancion_base || !historia || !parodia) {
      return NextResponse.json({ error: 'Faltan datos para guardar la parodia' }, { status: 400 });
    }

    const db = getDb();
    const nueva = {
      cancion_base,
      estilo:              estilo              ?? '',
      descripcionEstilo:   descripcionEstilo   ?? '',
      direccionGenerador:  direccionGenerador  ?? '',
      historia,
      parodia,
      fecha: new Date().toISOString(),
    };

    const docRef = await db.collection('parodias').add(nueva);
    return NextResponse.json({ id: docRef.id, ...nueva }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Firestore guardarParodia:', msg);
    return NextResponse.json({ error: 'Error al guardar la parodia' }, { status: 500 });
  }
}
