import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebaseService';
import { incrementarReproduccion } from '@/lib/cancionCompartidaService';
import { esNavegadorAdmin } from '@/lib/adminServidor';

export const runtime = 'nodejs';

// La página avisa aquí cuando una escucha empezó a sonar de verdad: este es el ▶️ del panel y lo que
// cuenta para el límite de escuchas gratis. Antes se contaba al bajar el audio, y quien tenía datos
// lentos sumaba varias sin haberla oído. Las del admin no cuentan.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (esNavegadorAdmin(request)) return NextResponse.json({ ok: true });
  if (!(await getDb().collection('canciones_compartidas').doc(id).get()).exists) {
    return NextResponse.json({ error: 'Link no válido' }, { status: 404 });
  }
  await incrementarReproduccion(id);
  return NextResponse.json({ ok: true });
}
