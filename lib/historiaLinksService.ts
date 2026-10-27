import { getDb } from './firebaseService';
import type { Plantilla } from './plantillasHistoria';

const COLLECTION = 'historia_links';

export interface HistoriaLink {
  telefono: string;
  token: string;
  fecha: string;
  nombre: string;
  // Sin plantilla = 'vida' (todos los links anteriores a los homenajes).
  plantilla?: Plantilla;
  // Solo en homenajes: de quién es la vida que se cuenta. `nombre` sigue
  // siendo quien responde (el dueño del teléfono).
  homenajeado?: string;
}

// El link de 'vida' sigue indexado solo por teléfono (así no cambia el id de
// ningún link ya entregado). Un homenaje va en otro documento, uno por
// homenajeado — la misma persona puede hacer su propia historia y además el
// homenaje a su papá y a su mamá, cada uno con su link.
function idDocumento(telefono: string, plantilla: Plantilla, homenajeado: string): string {
  if (plantilla !== 'homenaje') return telefono;
  const slug = homenajeado.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return telefono + '__homenaje__' + (slug || 'sin-nombre');
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
export async function obtenerOCrearLinkHistoria(telefono: string, nombre: string, plantilla: Plantilla = 'vida', homenajeado = ''): Promise<HistoriaLink> {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(idDocumento(telefono, plantilla, homenajeado));
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
  if (plantilla === 'homenaje') { nuevo.plantilla = 'homenaje'; nuevo.homenajeado = homenajeado; }
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

// Para admin/tenants: cruzar cada tenant por teléfono contra los links de
// Mi Historia ya generados, sin una query por tenant — se trae todo el
// (pequeño) catálogo de links una sola vez y el caller lo indexa.
export async function listarTodosLosLinks(): Promise<HistoriaLink[]> {
  const db = getDb();
  const snap = await db.collection(COLLECTION).get();
  return snap.docs.map(doc => doc.data() as HistoriaLink);
}
