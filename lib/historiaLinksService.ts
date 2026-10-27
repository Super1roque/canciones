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
  // Solo en cuentos: el niño o niña para quien es el cuento. `nombre` es
  // quien lo imagina (el dueño del teléfono).
  paraQuien?: string;
  // Solo en historias de empresa: la empresa o institución. `nombre` es
  // quien la cuenta (el dueño del teléfono).
  empresa?: string;
}

// El link de 'vida' sigue indexado solo por teléfono (así no cambia el id de
// ningún link ya entregado). Un homenaje o un cuento va en otro documento,
// uno por sujeto — la misma persona puede hacer su propia historia, el
// homenaje a su papá y un cuento para cada nieto, cada uno con su link.
function idDocumento(telefono: string, plantilla: Plantilla, sujeto: string): string {
  if (plantilla === 'vida') return telefono;
  const slug = sujeto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return telefono + '__' + plantilla + '__' + (slug || 'sin-nombre');
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
// sujeto: el homenajeado en un homenaje, el niño o niña en un cuento, la
// empresa o institución en una historia de empresa.
export async function obtenerOCrearLinkHistoria(telefono: string, nombre: string, plantilla: Plantilla = 'vida', sujeto = ''): Promise<HistoriaLink> {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(idDocumento(telefono, plantilla, sujeto));
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
  if (plantilla === 'homenaje') { nuevo.plantilla = 'homenaje'; nuevo.homenajeado = sujeto; }
  if (plantilla === 'cuento') { nuevo.plantilla = 'cuento'; nuevo.paraQuien = sujeto; }
  if (plantilla === 'empresa') { nuevo.plantilla = 'empresa'; nuevo.empresa = sujeto; }
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
