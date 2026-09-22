import admin from 'firebase-admin';
import { getDb, getStorageBucket } from './firebaseService';

const COLLECTION = 'canciones_compartidas';

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
