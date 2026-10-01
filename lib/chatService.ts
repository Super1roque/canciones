import admin from 'firebase-admin';
import { getDb } from './firebaseService';

const MENSAJES = 'mensajes';
const CONVERSACIONES = 'conversaciones';

export type Autor = 'tenant' | 'admin';

export interface Mensaje {
  id: string;
  telefono: string;
  autor: Autor;
  texto?: string;
  imagenPath?: string;
  imagenContentType?: string;
  fecha: string;
}

export interface Conversacion {
  telefono: string;
  ultimoTexto?: string;
  ultimaImagen: boolean;
  ultimoAutor: Autor;
  fecha: string;
  noLeidosAdmin: number;
  noLeidosTenant: number;
}

function toMensaje(id: string, data: FirebaseFirestore.DocumentData): Mensaje {
  return {
    id,
    telefono: data.telefono,
    autor: data.autor,
    texto: data.texto,
    imagenPath: data.imagenPath,
    imagenContentType: data.imagenContentType,
    fecha: data.fecha,
  };
}

// Sin orderBy en la query (igual que listarPedidosPorTelefono y
// listarTodasRecargas) para no necesitar un índice compuesto — se ordena
// acá mismo, en memoria.
export async function listarMensajes(telefono: string): Promise<Mensaje[]> {
  const db = getDb();
  const snap = await db.collection(MENSAJES).where('telefono', '==', telefono).get();
  return snap.docs.map(d => toMensaje(d.id, d.data())).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function obtenerMensaje(id: string): Promise<Mensaje | null> {
  const db = getDb();
  const doc = await db.collection(MENSAJES).doc(id).get();
  if (!doc.exists) return null;
  return toMensaje(doc.id, doc.data()!);
}

// Guarda el mensaje y actualiza el resumen de la conversación en un solo
// paso: le suma 1 al contador de "no leídos" del lado que lo recibe y
// resetea el propio (quien escribe ya vio todo lo anterior). Ese resumen
// es lo que lee la bandeja de /admin/mensajes sin tener que escanear toda
// la colección de mensajes cada vez.
export async function enviarMensaje(
  telefono: string,
  autor: Autor,
  datos: { texto?: string; imagenPath?: string; imagenContentType?: string }
): Promise<Mensaje> {
  const db = getDb();
  const fecha = new Date().toISOString();
  const ref = db.collection(MENSAJES).doc();

  const mensaje: Omit<Mensaje, 'id'> = {
    telefono,
    autor,
    fecha,
    ...(datos.texto ? { texto: datos.texto } : {}),
    ...(datos.imagenPath ? { imagenPath: datos.imagenPath, imagenContentType: datos.imagenContentType } : {}),
  };
  await ref.set(mensaje);

  const campoRecibe = autor === 'tenant' ? 'noLeidosAdmin' : 'noLeidosTenant';
  const campoPropio = autor === 'tenant' ? 'noLeidosTenant' : 'noLeidosAdmin';
  await db.collection(CONVERSACIONES).doc(telefono).set(
    {
      telefono,
      ultimoTexto: datos.texto ?? null,
      ultimaImagen: !!datos.imagenPath,
      ultimoAutor: autor,
      fecha,
      [campoRecibe]: admin.firestore.FieldValue.increment(1),
      [campoPropio]: 0,
    },
    { merge: true }
  );

  return { id: ref.id, ...mensaje };
}

// Para la señal de "mensajes pendientes" junto a "Soporte"/"Mensajes" en
// los menús — a diferencia de listarMensajes, esto NO marca nada como
// leído, así el contador se mantiene hasta que la persona realmente entra
// a ver la conversación.
export async function obtenerNoLeidos(telefono: string, lado: Autor): Promise<number> {
  const db = getDb();
  const doc = await db.collection(CONVERSACIONES).doc(telefono).get();
  if (!doc.exists) return 0;
  const campo = lado === 'admin' ? 'noLeidosAdmin' : 'noLeidosTenant';
  return (doc.data()?.[campo] as number) ?? 0;
}

// update() (no set con merge) a propósito: cualquier tenant que visite su
// dashboard llama a esto aunque todavía no tenga ningún mensaje — con
// set+merge eso creaba un documento de "conversación" a medias (sin
// telefono, sin fecha, nada más que el contador en 0), que después rompía
// el admin al intentar mostrarlo en la lista. update() en un documento que
// no existe tira NOT_FOUND, y acá no hay nada que marcar igual, así que se
// ignora sin problema.
export async function marcarLeido(telefono: string, lado: Autor): Promise<void> {
  const db = getDb();
  const campo = lado === 'admin' ? 'noLeidosAdmin' : 'noLeidosTenant';
  await db.collection(CONVERSACIONES).doc(telefono).update({ [campo]: 0 }).catch(() => {});
}

// Para la bandeja de /admin/mensajes — una fila por tenant que alguna vez
// mandó o recibió un mensaje, más reciente primero.
export async function listarConversaciones(): Promise<Conversacion[]> {
  const db = getDb();
  const snap = await db.collection(CONVERSACIONES).get();
  return snap.docs
    .map(d => d.data() as Conversacion)
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
}
