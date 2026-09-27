import admin from 'firebase-admin';
import { cookies } from 'next/headers';
import { getDb, getStorageBucket } from './firebaseService';

const COLLECTION = 'canciones_compartidas';

// Reemplaza el viejo límite por edad (60h) — ahora el corte es por
// cantidad de reproducciones del link, sin importar quién escuche ni
// cuánto tiempo pasó. Compartido entre la página y el endpoint que sirve
// el audio, para que el límite se aplique de verdad (no solo en la UI).
export const MAX_ESCUCHAS_GRATIS = 2;

export interface AccesoCancion {
  restringida: boolean;
  descargable: boolean;
  esDueño: boolean;
}

// El gratis-por-2-escuchas es para el dueño de la canción (quien la
// pidió), no para cualquiera que reciba el link — por eso se resuelve vía
// el pedido vinculado, no por la sesión de quien esté mirando la página.
// Las subidas sueltas (sin pedido, ej. /admin/compartir-cancion) no tienen
// dueño y quedan sin restricción ni límite de descarga.
//
// `restringida` y `descargable` son cosas distintas a propósito: la
// escucha es gratis las primeras MAX_ESCUCHAS_GRATIS veces aunque el
// dueño no sea premium, pero la descarga es un privilegio exclusivo de
// premium sin importar cuántas veces se escuchó.
// `esDueño` decide QUÉ mensaje ve quien se topa con el corte — el dueño ve
// la invitación a recargar; cualquier otra persona (a quien le reenviaron
// el link) ve un mensaje genérico que no expone que el dueño es freemium.
export async function calcularAcceso(id: string, reproducciones: number): Promise<AccesoCancion> {
  const db = getDb();
  const pedidosSnap = await db.collection('pedidos').where('cancionCompartidaId', '==', id).limit(1).get();
  if (pedidosSnap.empty) return { restringida: false, descargable: true, esDueño: false };

  const telefono = pedidosSnap.docs[0].data().telefono as string;
  const tenantDoc = await db.collection('tenants').doc(telefono).get();
  const premium = tenantDoc.exists && tenantDoc.data()?.plan === 'premium';

  const cookieStore = await cookies();
  const esDueño = cookieStore.get('tenant_phone')?.value === telefono;

  return {
    restringida: !premium && reproducciones >= MAX_ESCUCHAS_GRATIS,
    descargable: premium,
    esDueño,
  };
}

export interface CancionCompartida {
  id: string;
  titulo: string;
  fecha: string;
  reproducciones: number;
}

// Fire-and-forget desde el GET que sirve el audio — no debe demorar la
// reproducción esperando a que esto termine.
export function incrementarReproduccion(id: string): void {
  const db = getDb();
  void db.collection(COLLECTION).doc(id).update({
    reproducciones: admin.firestore.FieldValue.increment(1),
  }).catch(err => console.error('incrementarReproduccion:', err.message));
}

// Borra el archivo de Storage y el doc — para cuando se subió el audio
// equivocado y el link ya no debe existir en absoluto (no solo
// desvincularlo del pedido).
export async function eliminarCancionCompartida(id: string): Promise<void> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (doc.exists) {
    const storagePath = doc.data()!.storagePath as string | undefined;
    if (storagePath) {
      await getStorageBucket().file(storagePath).delete().catch(() => {});
    }
    await doc.ref.delete();
  }
}

export async function listarCancionesCompartidas(): Promise<CancionCompartida[]> {
  const db = getDb();
  const snap = await db.collection(COLLECTION).get();
  return snap.docs
    .map(d => {
      const data = d.data();
      return {
        id: d.id,
        titulo: data.titulo,
        fecha: data.fecha,
        reproducciones: data.reproducciones ?? 0,
      };
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}
