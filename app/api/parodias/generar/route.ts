import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebaseService';
import { generarParodia } from '@/lib/claudeService';

export async function POST(request: Request) {
  try {
    const { cancionId, historia } = await request.json();

    if (!cancionId || !historia) {
      return NextResponse.json({ error: 'Se requieren cancionId e historia' }, { status: 400 });
    }

    if (historia.trim().length < 10) {
      return NextResponse.json(
        { error: 'La historia debe tener al menos 10 caracteres' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'API key de Anthropic no configurada. Agrega ANTHROPIC_API_KEY en el archivo .env' },
        { status: 500 }
      );
    }

    const db = getDb();
    const doc = await db.collection('canciones').doc(cancionId).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Canción no encontrada' }, { status: 404 });
    }

    const cancion = { id: doc.id, ...doc.data() } as { id: string; nombre: string; estilo: string; descripcionEstilo?: string; direccionGenerador?: string; letra: string };
    const trimmed  = historia.trim();
    const parodia  = await generarParodia(cancion, trimmed);
    const modoPrueba = trimmed.toLowerCase().startsWith('esta es una prueba');

    return NextResponse.json({
      cancion_base: cancion.nombre,
      estilo: cancion.estilo,
      descripcionEstilo: cancion.descripcionEstilo ?? '',
      direccionGenerador: cancion.direccionGenerador ?? '',
      historia: trimmed,
      parodia,
      modoPrueba,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error generando parodia:', msg);
    return NextResponse.json({ error: 'Error al generar la parodia: ' + msg }, { status: 500 });
  }
}
