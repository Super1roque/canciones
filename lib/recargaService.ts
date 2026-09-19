import { getDb } from './firebaseService';
import { agregarSaldo } from './tenantService';

const COLLECTION = 'recargas';

export const MONTOS_VALIDOS = [300, 500, 1000] as const;

// Promo "flash": quien paga L 500 recibe L 600 de saldo, y quien paga
// L 1000 recibe L 1300. El monto pagado y el crédito otorgado quedan como
// campos separados en la recarga — así el admin ve claramente cuánto era
// el bono, y si el monto no tiene bono definido acá (como L 300), se
// acredita 1 a 1.
const CREDITO_POR_MONTO: Record<number, number> = { 500: 600, 1000: 1300 };

function calcularCredito(monto: number): number {
  return CREDITO_POR_MONTO[monto] ?? monto;
}

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

// El pago en sí se confirma manualmente (transferencia + comprobante por
// WhatsApp) — esto solo deja la solicitud anotada para que el admin la
// apruebe o rechace desde /admin/pedidos.
export async function crearSolicitudRecarga(telefono: string, monto: number): Promise<Recarga> {
  const db = getDb();
  const nuevo = {
    telefono,
    monto,
    credito: calcularCredito(monto),
    estado: 'pendiente' as const,
    fecha: new Date().toISOString(),
  };
  const docRef = await db.collection(COLLECTION).add(nuevo);
  return { id: docRef.id, ...nuevo };
}

export async function obtenerRecarga(id: string): Promise<Recarga | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return toRecarga(doc.id, doc.data()!);
}

export async function listarRecargasPorTelefono(telefono: string): Promise<Recarga[]> {
  const db = getDb();
  const snap = await db.collection(COLLECTION).where('telefono', '==', telefono).get();
  return snap.docs
    .map(d => toRecarga(d.id, d.data()))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
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
