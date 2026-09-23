import { getDb } from './firebaseService';
import { agregarSaldo } from './tenantService';

const COLLECTION = 'recargas';

export interface Recarga {
  id: string;
  telefono: string;
  monto: number;
  credito: number;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  fecha: string;
  fechaResolucion?: string;
}

function toRecarga(id: string, data: FirebaseFirestore.DocumentData): Recarga {
  return {
    id,
    telefono: data.telefono,
    monto: data.monto,
    // Recargas guardadas antes de que existiera el bono no tienen este
    // campo — se acreditó 1 a 1, así que el monto es el crédito real.
    credito: data.credito ?? data.monto,
    estado: data.estado,
    fecha: data.fecha,
    fechaResolucion: data.fechaResolucion,
  };
}

export async function listarTodasRecargas(): Promise<Recarga[]> {
  const db = getDb();
  const snap = await db.collection(COLLECTION).get();
  return snap.docs
    .map(d => toRecarga(d.id, d.data()))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export async function resolverRecarga(id: string, aprobar: boolean): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('RECARGA_NO_ENCONTRADA');

  const data = doc.data() as { estado: string; telefono: string; monto: number; credito?: number };
  if (data.estado !== 'pendiente') throw new Error('RECARGA_YA_RESUELTA');

  await ref.update({
    estado: aprobar ? 'aprobada' : 'rechazada',
    fechaResolucion: new Date().toISOString(),
  });
  if (aprobar) await agregarSaldo(data.telefono, data.credito ?? data.monto);
}
