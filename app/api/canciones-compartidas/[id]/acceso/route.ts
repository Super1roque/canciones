import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebaseService';
import { calcularAcceso, estaEscuchada } from '@/lib/cancionCompartidaService';

export const runtime = 'nodejs';

// La página de la canción pregunta aquí si ya se pagó la descarga: así, cuando el admin la habilita,
// el botón «Descargar — L 250» cambia solo por el de descarga, sin recargar la página. También antes
// de cada escucha, si ya alguien la escuchó completa: WhatsApp a veces devuelve la página guardada
// de antes, y esa no se entera sola.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getDb().collection('canciones_compartidas').doc(id).get();
  if (!doc.exists) return NextResponse.json({ error: 'Link no válido' }, { status: 404 });
  const { descargable } = await calcularAcceso(id, doc.data()?.reproducciones ?? 0);
  return NextResponse.json({ descargable, escuchada: estaEscuchada(doc.data()) }, { headers: { 'Cache-Control': 'no-store' } });
}
