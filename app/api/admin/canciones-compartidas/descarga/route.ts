import { NextResponse } from 'next/server';
import { habilitarDescarga } from '@/lib/cancionCompartidaService';
import { soloAdmin } from '@/lib/adminServidor';
import { getDb } from '@/lib/firebaseService';
import { avisarDescargaLista } from '@/lib/pushService';

// El cliente pagó (o se le devuelve) la descarga de una canción — ver
// habilitarDescarga en lib/cancionCompartidaService.ts.
export async function POST(request: Request) {
  const negado = await soloAdmin(request);
  if (negado) return negado;
  try {
    const { id, habilitar } = await request.json();
    if (!id) return NextResponse.json({ error: 'Falta la canción' }, { status: 400 });
    await habilitarDescarga(id, habilitar !== false);
    if (habilitar !== false) {
      // Si la persona pagó desde la página y ya cerró, se entera por notificación de que ya puede descargar.
      const db = getDb();
      const [cancion, pedido] = await Promise.all([
        db.collection('canciones_compartidas').doc(id).get(),
        db.collection('pedidos').where('cancionCompartidaId', '==', id).limit(1).get(),
      ]);
      if (!pedido.empty) void avisarDescargaLista(pedido.docs[0].get('telefono'), cancion.get('titulo') ?? 'tu canción', id);
    }
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('canciones-compartidas/descarga:', msg);
    return NextResponse.json({ error: 'Error al cambiar la descarga' }, { status: 500 });
  }
}
