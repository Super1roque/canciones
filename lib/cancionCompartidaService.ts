import admin from 'firebase-admin';
import { getDb } from './firebaseService';

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
