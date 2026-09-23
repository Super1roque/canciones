import { NextResponse } from 'next/server';
import { getDb, getStorageBucket } from '@/lib/firebaseService';

// Info de vista previa para el modal de confirmación de borrado en
// /admin/tenants — mismos datos que antes había que revisar a mano en
// Firestore antes de borrar un tenant (pedidos, recargas, verificaciones).
export async function GET(_request: Request, { params }: { params: Promise<{ telefono: string }> }) {
  const { telefono } = await params;
  const db = getDb();

  const tenantDoc = await db.collection('tenants').doc(telefono).get();
  if (!tenantDoc.exists) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 });

  const [pedidosSnap, recargasSnap, verifSnap] = await Promise.all([
    db.collection('pedidos').where('telefono', '==', telefono).get(),
    db.collection('recargas').where('telefono', '==', telefono).get(),
    db.collection('verificaciones').where('telefono', '==', telefono).get(),
  ]);

  return NextResponse.json({
    tenant: tenantDoc.data(),
    pedidos: pedidosSnap.docs.map(d => ({
      id: d.id,
      cancion_base: d.data().cancion_base,
      fecha: d.data().fecha,
      estado: d.data().estado,
      tieneLink: !!d.data().cancionCompartidaId,
    })),
    recargas: recargasSnap.docs.map(d => ({
      id: d.id,
      monto: d.data().monto,
      credito: d.data().credito,
      estado: d.data().estado,
      fecha: d.data().fecha,
    })),
    verificacionesCount: verifSnap.size,
  });
}

// Borra el tenant y todo lo que le pertenece: pedidos (y el audio/doc de
// canciones_compartidas que tuvieran vinculado, incluyendo el archivo en
// Storage), recargas y verificaciones — el mismo cascade que se venía
// haciendo a mano cada vez que se pedía borrar un tenant de prueba.
export async function DELETE(_request: Request, { params }: { params: Promise<{ telefono: string }> }) {
  try {
    const { telefono } = await params;
    const db = getDb();
    const bucket = getStorageBucket();

    const pedidosSnap = await db.collection('pedidos').where('telefono', '==', telefono).get();
    for (const doc of pedidosSnap.docs) {
      const cancionId = doc.data().cancionCompartidaId as string | undefined;
      if (cancionId) {
        const ccDoc = await db.collection('canciones_compartidas').doc(cancionId).get();
        if (ccDoc.exists) {
          const storagePath = ccDoc.data()!.storagePath as string | undefined;
          if (storagePath) await bucket.file(storagePath).delete().catch(() => {});
          await ccDoc.ref.delete();
        }
      }
      await doc.ref.delete();
    }

    const recargasSnap = await db.collection('recargas').where('telefono', '==', telefono).get();
    for (const doc of recargasSnap.docs) await doc.ref.delete();

    const verifSnap = await db.collection('verificaciones').where('telefono', '==', telefono).get();
    for (const doc of verifSnap.docs) await doc.ref.delete();

    await db.collection('tenants').doc(telefono).delete();

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('eliminar tenant:', msg);
    return NextResponse.json({ error: 'Error al borrar el tenant' }, { status: 500 });
  }
}
