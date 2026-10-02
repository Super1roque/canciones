import { getDb } from './firebaseService';

const COLLECTION = 'historia_links';

export interface HistoriaLink {
  telefono: string;
  token: string;
  fecha: string;
  nombre: string;
}

// Token largo y random (122 bits) — no hace falta más: es el único
// "candado" de /historia/[clave], que no pide ningún login.
function generarToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

// get-or-create, igual que obtenerOCrearTenant: si a este tenant ya se le
// había generado un link antes, se le devuelve el mismo (mismo token, no
// pierde el progreso que ya haya guardado ahí) — pero el nombre sí se
// actualiza, por si el admin lo vuelve a generar para corregir un error
// de tipeo.
export async function obtenerOCrearLinkHistoria(telefono: string, nombre: string): Promise<HistoriaLink> {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(telefono);
  const doc = await ref.get();
  if (doc.exists) {
    const existente = doc.data() as HistoriaLink;
    if (existente.nombre !== nombre) {
      await ref.update({ nombre });
      return { ...existente, nombre };
    }
    return existente;
  }

  const nuevo: HistoriaLink = { telefono, token: generarToken(), fecha: new Date().toISOString(), nombre };
  await ref.set(nuevo);
  return nuevo;
}

// Para que la página pública (/historia/[clave]) sepa de quién es la
// historia y pueda saludarla por su nombre — el documento está indexado
// por teléfono, no por token, así que acá se busca al revés.
export async function obtenerLinkPorToken(token: string): Promise<HistoriaLink | null> {
  const db = getDb();
  const snap = await db.collection(COLLECTION).where('token', '==', token).limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].data() as HistoriaLink;
}
