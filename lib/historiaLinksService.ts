import { getDb } from './firebaseService';

const COLLECTION = 'historia_links';

export interface HistoriaLink {
  telefono: string;
  token: string;
  fecha: string;
}

// Token largo y random (122 bits) — no hace falta más: es el único
// "candado" de /historia/[clave], que no pide ningún login.
function generarToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

// get-or-create, igual que obtenerOCrearTenant: si a este tenant ya se le
// había generado un link antes, se le devuelve el mismo en vez de uno
// nuevo — así no pierde el progreso que ya haya guardado ahí, ni el admin
// termina con dos links distintos para la misma persona.
export async function obtenerOCrearLinkHistoria(telefono: string): Promise<HistoriaLink> {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(telefono);
  const doc = await ref.get();
  if (doc.exists) return doc.data() as HistoriaLink;

  const nuevo: HistoriaLink = { telefono, token: generarToken(), fecha: new Date().toISOString() };
  await ref.set(nuevo);
  return nuevo;
}
