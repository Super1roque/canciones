import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { cookies } from 'next/headers';
import admin from 'firebase-admin';
import { getDb } from '@/lib/firebaseService';
import { esNavegadorAdmin } from '@/lib/adminServidor';
import { VISITAS_FB_PARA_DESBLOQUEO } from '@/lib/pagoDescarga';
import { avisarDescargaLista } from '@/lib/pushService';

export const runtime = 'nodejs';

// Alguien abrió la canción desde una publicación de Facebook (link ?c=fb con fbclid o referencia de Facebook). Se
// cuenta una vez por persona —huella de IP + navegador, sin guardar la IP— y no cuentan el dueño ni el admin. Al
// llegar a VISITAS_FB_PARA_DESBLOQUEO visitas distintas, la descarga se habilita sola (ver lib/pagoDescarga.ts).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (esNavegadorAdmin(request)) return NextResponse.json({ ok: true });
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '';
  const ua = request.headers.get('user-agent') ?? '';
  if (!ip || /bot|crawl|facebookexternalhit|spider/i.test(ua)) return NextResponse.json({ ok: true });

  const db = getDb();
  const ref = db.collection('canciones_compartidas').doc(id);
  const pedido = await db.collection('pedidos').where('cancionCompartidaId', '==', id).limit(1).get();
  const telefonoDueño = pedido.empty ? null : pedido.docs[0].get('telefono') as string;
  if (telefonoDueño && (await cookies()).get('tenant_phone')?.value === telefonoDueño) return NextResponse.json({ ok: true });

  const huella = createHash('sha256').update(`${id}|${ip}|${ua}`).digest('hex').slice(0, 40);
  const resultado = await db.runTransaction(async tx => {
    const doc = await tx.get(ref);
    if (!doc.exists) return null;
    const visita = ref.collection('visitasFb').doc(huella);
    if ((await tx.get(visita)).exists) return { visitas: doc.get('visitasFb') ?? 0, desbloqueo: false };
    const visitas = (doc.get('visitasFb') ?? 0) + 1;
    tx.set(visita, { fecha: new Date().toISOString() });
    const desbloqueo = visitas >= VISITAS_FB_PARA_DESBLOQUEO && doc.get('descargaHabilitada') !== true;
    tx.update(ref, {
      visitasFb: admin.firestore.FieldValue.increment(1),
      ...(desbloqueo ? { descargaHabilitada: true, desbloqueadaPor: 'facebook', fechaDesbloqueo: new Date().toISOString() } : {}),
    });
    return { visitas, desbloqueo, titulo: doc.get('titulo') as string };
  });
  if (!resultado) return NextResponse.json({ error: 'Link no válido' }, { status: 404 });
  if (resultado.desbloqueo && telefonoDueño) void avisarDescargaLista(telefonoDueño, resultado.titulo ?? 'tu canción', id);
  return NextResponse.json({ ok: true, visitas: resultado.visitas });
}
