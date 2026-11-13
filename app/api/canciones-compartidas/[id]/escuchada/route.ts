import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebaseService';

export const runtime = 'nodejs';

// La página de la canción avisa aquí cuando alguien la escuchó completa por primera vez: desde
// entonces, cualquier escucha (en cualquier aparato) sale con pausas si la descarga no está pagada,
// para que no la graben con otro teléfono. Solo se marca una vez; las del admin no llegan aquí.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ref = getDb().collection('canciones_compartidas').doc(id);
  const doc = await ref.get();
  if (!doc.exists) return NextResponse.json({ error: 'Link no válido' }, { status: 404 });
  if (doc.get('escuchadaCompleta') !== true) await ref.update({ escuchadaCompleta: true });
  return NextResponse.json({ ok: true });
}
