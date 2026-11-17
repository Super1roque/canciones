import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebaseService';
import { calcularAcceso, estaEscuchada } from '@/lib/cancionCompartidaService';

export const runtime = 'nodejs';

// La página de la canción pregunta aquí si la descarga ya está habilitada (por compartir o por el admin): así el
// botón de descarga aparece solo, sin recargar la página. También antes
// de cada escucha, si ya alguien la escuchó completa: WhatsApp a veces devuelve la página guardada
// de antes, y esa no se entera sola.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getDb().collection('canciones_compartidas').doc(id).get();
  if (!doc.exists) return NextResponse.json({ error: 'Link no válido' }, { status: 404 });
  const { descargable } = await calcularAcceso(id, doc.data()?.reproducciones ?? 0);
  const visitasCompartidas = doc.get('visitasCompartidas') ?? 0;   // progreso de la descarga gratis por compartir
  return NextResponse.json({ descargable, escuchada: estaEscuchada(doc.data()), visitasCompartidas }, { headers: { 'Cache-Control': 'no-store' } });
}
