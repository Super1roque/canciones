import admin from 'firebase-admin';
import { cookies } from 'next/headers';
import { getDb, getStorageBucket } from './firebaseService';

const COLLECTION = 'canciones_compartidas';

// Reemplaza el viejo límite por edad (60h) — ahora el corte es por
// cantidad de reproducciones del link, sin importar quién escuche ni
// cuánto tiempo pasó. Compartido entre la página y el endpoint que sirve
// el audio, para que el límite se aplique de verdad (no solo en la UI).
export const MAX_ESCUCHAS_GRATIS = 2;

export interface AccesoCancion {
  restringida: boolean;
  descargable: boolean;
  esDueño: boolean;
}

// El gratis-por-2-escuchas es para el dueño de la canción (quien la
// pidió), no para cualquiera que reciba el link — por eso se resuelve vía
// el pedido vinculado, no por la sesión de quien esté mirando la página.
// Las subidas sueltas (sin pedido, ej. /admin/compartir-cancion) no tienen
// dueño y quedan sin restricción ni límite de descarga.
//
// `restringida` y `descargable` son cosas distintas a propósito: la
// escucha es gratis las primeras MAX_ESCUCHAS_GRATIS veces aunque el
// dueño no sea premium, pero la descarga se cobra aparte, canción por
// canción (L 250 por WhatsApp): solo se puede bajar si el admin le marcó
// `descargaHabilitada` desde /admin/pedidos, sin importar el plan.
// `esDueño` decide QUÉ mensaje ve quien se topa con el corte — el dueño ve
// la invitación a recargar; cualquier otra persona (a quien le reenviaron
// el link) ve un mensaje genérico que no expone que el dueño es freemium.
export async function calcularAcceso(id: string, reproducciones: number): Promise<AccesoCancion> {
  const db = getDb();
  const pedidosSnap = await db.collection('pedidos').where('cancionCompartidaId', '==', id).limit(1).get();
  if (pedidosSnap.empty) return { restringida: false, descargable: true, esDueño: false };

  const telefono = pedidosSnap.docs[0].data().telefono as string;
  const tenantDoc = await db.collection('tenants').doc(telefono).get();
  const premium = tenantDoc.exists && tenantDoc.data()?.plan === 'premium';

  const cookieStore = await cookies();
  const esDueño = cookieStore.get('tenant_phone')?.value === telefono;

  const cancionDoc = await db.collection(COLLECTION).doc(id).get();

  return {
    restringida: !premium && reproducciones >= MAX_ESCUCHAS_GRATIS,
    descargable: cancionDoc.data()?.descargaHabilitada === true,
    esDueño,
  };
}

// Sin la descarga pagada, la canción se puede escuchar HORAS_VIGENCIA horas desde que se subió; después
// el audio deja de servirse (el archivo sigue guardado: si paga, el admin habilita la descarga y vuelve).
// Las canciones de antes de esta regla cuentan desde INICIO_VIGENCIA, no desde su fecha, para que
// ninguna se bloquee de golpe al publicarla. `vigenteDesde` lo pone el botón «Darle 36 h más» del panel.
export const HORAS_VIGENCIA = 36;
const INICIO_VIGENCIA = '2026-11-13T16:37:00Z';
export function venceEn(data: { fecha: string; vigenteDesde?: string }): number {
  const desde = Math.max(Date.parse(data.fecha) || 0, Date.parse(INICIO_VIGENCIA), Date.parse(data.vigenteDesde ?? '') || 0);
  return desde + HORAS_VIGENCIA * 3600 * 1000;
}

// Vuelve a contar las 36 h desde ahora: revive una canción vencida (o le da más tiempo) sin habilitar la descarga.
export async function prorrogarVigencia(id: string): Promise<void> {
  await getDb().collection(COLLECTION).doc(id).update({ vigenteDesde: new Date().toISOString() });
}

export interface CancionPendiente {
  id: string;
  titulo: string;
  vence: number;
}

// Las canciones del tenant sin la descarga pagada que todavía suenan (no vencieron), la más urgente
// primero — para recordárselas al entrar a su cuenta.
export async function cancionesPendientes(telefono: string): Promise<CancionPendiente[]> {
  const db = getDb();
  const pedidos = await db.collection('pedidos').where('telefono', '==', telefono).get();
  const ids = [...new Set(pedidos.docs.map(d => d.data().cancionCompartidaId as string | undefined).filter((id): id is string => !!id))];
  if (!ids.length) return [];
  const docs = await db.getAll(...ids.map(id => db.collection(COLLECTION).doc(id)));
  const ahora = Date.now();
  return docs
    .filter(d => d.exists && d.data()!.descargaHabilitada !== true)
    .map(d => ({ id: d.id, titulo: d.data()!.titulo as string, vence: venceEn(d.data() as { fecha: string; vigenteDesde?: string }) }))
    .filter(c => c.vence > ahora)
    .sort((a, b) => a.vence - b.vence);
}

// Si ya alguien la escuchó completa: desde ahí toda escucha sin descarga pagada sale con pausas.
// Canciones de antes de esta marca: si ya tenían reproducciones, cuentan como escuchadas.
export function estaEscuchada(data: { escuchadaCompleta?: boolean; reproducciones?: number } | undefined): boolean {
  return data?.escuchadaCompleta === true || (data?.escuchadaCompleta === undefined && (data?.reproducciones ?? 0) >= 1);
}

export interface CancionCompartida {
  id: string;
  titulo: string;
  fecha: string;
  reproducciones: number;
  descargaHabilitada: boolean;
  escuchasConPausa: number;
  vence: number;
}

// Botón "Habilitar descarga" de /admin/pedidos — cuando el cliente pagó
// los L 250 de la descarga por WhatsApp.
export async function habilitarDescarga(id: string, habilitar: boolean): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION).doc(id).update({ descargaHabilitada: habilitar });
}

// Fire-and-forget desde el GET que sirve el audio — no debe demorar la
// reproducción esperando a que esto termine.
export function incrementarReproduccion(id: string): void {
  const db = getDb();
  void db.collection(COLLECTION).doc(id).update({
    reproducciones: admin.firestore.FieldValue.increment(1),
  }).catch(err => console.error('incrementarReproduccion:', err.message));
}

// Borra el archivo de Storage y el doc — para cuando se subió el audio
// equivocado y el link ya no debe existir en absoluto (no solo
// desvincularlo del pedido).
export async function eliminarCancionCompartida(id: string): Promise<void> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (doc.exists) {
    const storagePath = doc.data()!.storagePath as string | undefined;
    if (storagePath) {
      await getStorageBucket().file(storagePath).delete().catch(() => {});
    }
    await doc.ref.delete();
  }
}

export async function listarCancionesCompartidas(): Promise<CancionCompartida[]> {
  const db = getDb();
  const snap = await db.collection(COLLECTION).get();
  return snap.docs
    .map(d => {
      const data = d.data();
      return {
        id: d.id,
        titulo: data.titulo,
        fecha: data.fecha,
        reproducciones: data.reproducciones ?? 0,
        descargaHabilitada: data.descargaHabilitada === true,
        escuchasConPausa: data.escuchasConPausa ?? 0,
        vence: venceEn({ fecha: data.fecha, vigenteDesde: data.vigenteDesde }),
      };
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}
