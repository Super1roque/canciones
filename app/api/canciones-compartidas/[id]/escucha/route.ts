import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { getDb } from '@/lib/firebaseService';
import { esNavegadorAdmin } from '@/lib/adminServidor';

export const runtime = 'nodejs';

// Registro de cada escucha de la página de la canción (canciones_compartidas/<id>/escuchas): si salió
// con pausas, cuántas planeó y cuántas hizo, y hasta qué % llegó. La página manda la misma escucha
// varias veces (al empezar, al salir, al terminar) y aquí se va completando la misma fila.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (esNavegadorAdmin(request)) return NextResponse.json({ ok: true });   // el admin no cuenta
  let datos: Record<string, unknown>;
  try {
    datos = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 });
  }
  const escuchaId = String(datos.id ?? '');
  if (!/^[\w-]{8,64}$/.test(escuchaId)) return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 });
  const numero = (v: unknown, max: number) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));

  const ref = getDb().collection('canciones_compartidas').doc(id);
  if (!(await ref.get()).exists) return NextResponse.json({ error: 'Link no válido' }, { status: 404 });
  await ref.collection('escuchas').doc(escuchaId).set({
    conPausas: datos.conPausas === true,
    pausasPlaneadas: numero(datos.pausasPlaneadas, 10),
    pausasHechas: numero(datos.pausasHechas, 10),
    duracion: numero(datos.duracion, 3600),
    avance: numero(datos.avance, 100),
    navegador: (request.headers.get('user-agent') ?? '').slice(0, 200),
    actualizada: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return NextResponse.json({ ok: true });
}
