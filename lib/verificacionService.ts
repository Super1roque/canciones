import { getDb } from './firebaseService';

const COLLECTION = 'verificaciones';

export interface Verificacion {
  id: string;
  telefono: string;
  codigo: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  fecha: string;
}

function generarCodigo(): string {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
}

function toVerificacion(id: string, data: FirebaseFirestore.DocumentData): Verificacion {
  return {
    id,
    telefono: data.telefono,
    codigo: data.codigo,
    estado: data.estado,
    fecha: data.fecha,
  };
}

// El teléfono acá es el que la persona TIPEÓ en el formulario — todavía sin
// confirmar. Recién se confía en él si el admin aprueba viendo que el
// mensaje de WhatsApp llegó justo de ese número (ver resolverVerificacion).
export async function crearSolicitudVerificacion(telefono: string): Promise<Verificacion> {
  const db = getDb();
  const nuevo = {
    telefono,
    codigo: generarCodigo(),
    estado: 'pendiente' as const,
    fecha: new Date().toISOString(),
  };
  const docRef = await db.collection(COLLECTION).add(nuevo);
  return { id: docRef.id, ...nuevo };
}

export async function obtenerVerificacion(id: string): Promise<Verificacion | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return toVerificacion(doc.id, doc.data()!);
}

export async function listarVerificacionesPendientes(): Promise<Verificacion[]> {
  const db = getDb();
  const snap = await db.collection(COLLECTION).where('estado', '==', 'pendiente').get();
  return snap.docs
    .map(d => toVerificacion(d.id, d.data()))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export async function resolverVerificacion(id: string, aprobar: boolean): Promise<Verificacion> {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('VERIFICACION_NO_ENCONTRADA');

  const data = doc.data()!;
  if (data.estado !== 'pendiente') throw new Error('VERIFICACION_YA_RESUELTA');

  const estado = aprobar ? ('aprobada' as const) : ('rechazada' as const);
  await ref.update({ estado });
  return toVerificacion(id, { ...data, estado });
}
