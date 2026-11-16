import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { cookies } from 'next/headers';
import admin from 'firebase-admin';
import { getDb } from '@/lib/firebaseService';
import { esNavegadorAdmin } from '@/lib/adminServidor';
import { CODIGO_VALIDO, VISITAS_PARA_DESBLOQUEO } from '@/lib/pagoDescarga';
import { avisarDescargaLista } from '@/lib/pushService';

export const runtime = 'nodejs';

// Alguien abrió la canción con un link compartido (?c=<código>, de Facebook, WhatsApp o donde sea). Cuenta una vez
// por persona —huella de IP + navegador, sin guardar la IP— y no cuentan el teléfono que la compartió, el dueño ni el
// admin, ni los códigos que no salieron de un botón de compartir. Al llegar a VISITAS_PARA_DESBLOQUEO, la descarga se
// habilita sola (ver lib/pagoDescarga.ts).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (esNavegadorAdmin(request)) return NextResponse.json({ ok: true });
  const { c } = await request.json().catch(() => ({}));
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '';
  const ua = request.headers.get('user-agent') ?? '';
  if (!CODIGO_VALIDO.test(String(c ?? '')) || !ip || /bot|crawl|facebookexternalhit|whatsapp|spider/i.test(ua)) {
    return NextResponse.json({ ok: true });
  }

  const db = getDb();
  const ref = db.collection('canciones_compartidas').doc(id);
  const pedido = await db.collection('pedidos').where('cancionCompartidaId', '==', id).limit(1).get();
  const telefonoDueño = pedido.empty ? null : pedido.docs[0].get('telefono') as string;
  if (telefonoDueño && (await cookies()).get('tenant_phone')?.value === telefonoDueño) return NextResponse.json({ ok: true });

  const huella = createHash('sha256').update(`${id}|${ip}|${ua}`).digest('hex').slice(0, 40);
  const compartidor = await ref.collection('compartidores').doc(String(c)).get();
  if (!compartidor.exists || compartidor.get('huella') === huella) return NextResponse.json({ ok: true });

  const resultado = await db.runTransaction(async tx => {
    const doc = await tx.get(ref);
    if (!doc.exists) return null;
    const visita = ref.collection('visitas').doc(huella);
    if ((await tx.get(visita)).exists) return { visitas: doc.get('visitasCompartidas') ?? 0, desbloqueo: false };
    const visitas = (doc.get('visitasCompartidas') ?? 0) + 1;
    tx.set(visita, { fecha: new Date().toISOString(), c: String(c) });
    const desbloqueo = visitas >= VISITAS_PARA_DESBLOQUEO && doc.get('descargaHabilitada') !== true;
    tx.update(ref, {
      visitasCompartidas: admin.firestore.FieldValue.increment(1),
      ...(desbloqueo ? { descargaHabilitada: true, desbloqueadaPor: 'compartir', fechaDesbloqueo: new Date().toISOString() } : {}),
    });
    return { visitas, desbloqueo, titulo: doc.get('titulo') as string };
  });
  if (!resultado) return NextResponse.json({ error: 'Link no válido' }, { status: 404 });
  if (resultado.desbloqueo && telefonoDueño) void avisarDescargaLista(telefonoDueño, resultado.titulo ?? 'tu canción', id);
  return NextResponse.json({ ok: true, visitas: resultado.visitas });
}
