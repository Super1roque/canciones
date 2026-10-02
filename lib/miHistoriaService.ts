import { getDb, getStorageBucket } from './firebaseService';

const COLLECTION = 'mi_historia';

// Clave del documento del admin — el resto de las historias (una por cada
// link que se le da a un tenant, ver lib/historiaLinksService.ts) usan de
// clave el token random de su link.
export const CLAVE_ADMIN = 'principal';

export interface HistoriaData {
  meta: { creado: string; actualizado: string };
  respuestas: Record<string, {
    texto: string;
    estado: 'sin_responder' | 'respondida' | 'necesita_profundizacion' | 'completada' | 'no_responder' | 'no_recuerdo';
    volverDespues: boolean;
    profundizaciones: { pregunta: string; respuesta: string }[];
  }>;
  notasLibres: { id: string; etapaIdx: number; texto: string; fecha: string }[];
  personas: Record<string, unknown>[];
  fotografias: {
    id: string; contentType: string; descripcion: string; año: string; lugar: string;
    personas: string; queOcurria: string; porQueImportante: string; etapaRelacionada: string;
  }[];
  lineaDeTiempo: Record<string, unknown>[];
  contradicciones: { id: string; nota: string }[];
}

function estadoVacio(): HistoriaData {
  const ahora = new Date().toISOString();
  return {
    meta: { creado: ahora, actualizado: ahora },
    respuestas: {}, notasLibres: [], personas: [], fotografias: [], lineaDeTiempo: [], contradicciones: [],
  };
}

export async function obtenerHistoria(clave: string): Promise<HistoriaData> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).doc(clave).get();
  if (!doc.exists) return estadoVacio();
  return Object.assign(estadoVacio(), doc.data());
}

export async function guardarHistoria(clave: string, data: HistoriaData): Promise<void> {
  const db = getDb();
  data.meta.actualizado = new Date().toISOString();
  await db.collection(COLLECTION).doc(clave).set(data);
}

// Mismo criterio que el audio en el resto de la app: nunca una URL de
// Storage directa/firmada — las fotos se sirven por nuestra propia API
// (/api/historia/[clave]/foto/[id]), que descarga el archivo del bucket
// server-side. Separadas por carpeta (clave/id), no solo por id random —
// así el link de un tenant nunca puede leer ni borrar la foto de otra
// historia aunque adivinara el id, porque ni siquiera existe bajo SU
// carpeta.
export function pathFotoHistoria(clave: string, id: string): string {
  return `mi-historia/${clave}/${id}`;
}

export async function subirFotoHistoria(clave: string, buffer: Buffer, contentType: string, id: string): Promise<void> {
  await getStorageBucket().file(pathFotoHistoria(clave, id)).save(buffer, { metadata: { contentType } });
}

export async function eliminarFotoHistoria(clave: string, id: string): Promise<void> {
  await getStorageBucket().file(pathFotoHistoria(clave, id)).delete().catch(() => {});
}
