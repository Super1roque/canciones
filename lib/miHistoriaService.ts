import { getDb, getStorageBucket } from './firebaseService';

const COLLECTION = 'mi_historia';
const DOC_ID = 'principal';

// Una sola biografía por ahora (herramienta personal del admin, no
// multi-usuario) — todo vive en un único documento.
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

export async function obtenerHistoria(): Promise<HistoriaData> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).doc(DOC_ID).get();
  if (!doc.exists) return estadoVacio();
  return Object.assign(estadoVacio(), doc.data());
}

export async function guardarHistoria(data: HistoriaData): Promise<void> {
  const db = getDb();
  data.meta.actualizado = new Date().toISOString();
  await db.collection(COLLECTION).doc(DOC_ID).set(data);
}

// Mismo criterio que el audio en el resto de la app: nunca una URL de
// Storage directa/firmada — las fotos se sirven por nuestra propia API
// (/api/admin/mi-historia/foto/[id]), que descarga el archivo del bucket
// server-side. El path es determinístico a partir del id, así no hace
// falta guardarlo aparte.
export function pathFotoHistoria(id: string): string {
  return `mi-historia/${id}`;
}

export async function subirFotoHistoria(buffer: Buffer, contentType: string, id: string): Promise<void> {
  await getStorageBucket().file(pathFotoHistoria(id)).save(buffer, { metadata: { contentType } });
}

export async function eliminarFotoHistoria(id: string): Promise<void> {
  await getStorageBucket().file(pathFotoHistoria(id)).delete().catch(() => {});
}
