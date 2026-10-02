import webpush from 'web-push';
import { getDb } from './firebaseService';

const COLLECTION_ADMIN = 'push_suscripciones';
const COLLECTION_TENANTS = 'push_suscripciones_tenants';

let configurado = false;
function configurar() {
  if (configurado) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configurado = true;
}

// El endpoint de la suscripción es único por navegador/dispositivo — sirve
// de id para no duplicar si la misma persona se vuelve a suscribir desde
// el mismo lugar.
function idDeEndpoint(endpoint: string): string {
  return Buffer.from(endpoint).toString('base64url').slice(0, 400);
}

// Una por navegador/dispositivo donde el admin haya tocado "Activar
// notificaciones" — puede haber varias (celular + laptop), todas reciben
// el aviso.
export async function guardarSuscripcionPush(subscription: webpush.PushSubscription): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION_ADMIN).doc(idDeEndpoint(subscription.endpoint)).set({
    subscription,
    fecha: new Date().toISOString(),
  });
}

export async function eliminarSuscripcionPush(endpoint: string): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION_ADMIN).doc(idDeEndpoint(endpoint)).delete().catch(() => {});
}

// Suscripción de un TENANT — separada de la del admin porque acá sí
// importa a QUIÉN avisarle (el teléfono), a diferencia del admin que es
// uno solo. Puede haber varias por tenant (celular + laptop).
export async function guardarSuscripcionPushTenant(telefono: string, subscription: webpush.PushSubscription): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION_TENANTS).doc(idDeEndpoint(subscription.endpoint)).set({
    telefono,
    subscription,
    fecha: new Date().toISOString(),
  });
}

export async function eliminarSuscripcionPushTenant(endpoint: string): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION_TENANTS).doc(idDeEndpoint(endpoint)).delete().catch(() => {});
}

// Manda el mismo payload a una lista de documentos con suscripción —
// compartido entre avisos al admin y a tenants. urgency:'high' le pide a
// FCM que lo trate como prioritario, lo que en Android lo hace más
// probable que despierte a Chrome aunque el sistema esté en modo ahorro de
// batería con la pantalla apagada. 410/404 = suscripción vencida (el
// navegador la invalidó, ej. se desinstaló la PWA) — se borra para no
// seguir intentando para siempre contra un endpoint muerto.
async function enviarATodos(docs: FirebaseFirestore.QueryDocumentSnapshot[], payload: string): Promise<void> {
  await Promise.all(docs.map(async (doc) => {
    try {
      await webpush.sendNotification(doc.data().subscription, payload, { urgency: 'high' });
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await doc.ref.delete().catch(() => {});
      } else {
        console.error('push enviarATodos:', error);
      }
    }
  }));
}

// Se llama cuando un TENANT manda un mensaje — el admin es quien necesita
// enterarse al toque, aunque no tenga la app abierta (de ahí push en vez
// de solo el polling que ya existe para cuando sí la tiene abierta). Sin
// `silent` en las opciones de la notificación: así el navegador/SO usa su
// sonido de notificación por defecto, igual que WhatsApp Web.
export async function avisarNuevoMensajeAdmin(telefono: string, texto?: string): Promise<void> {
  if (!process.env.VAPID_PRIVATE_KEY) return; // no configurado — no hacer nada
  configurar();

  const db = getDb();
  const snap = await db.collection(COLLECTION_ADMIN).get();
  if (snap.empty) return;

  const payload = JSON.stringify({
    titulo: '💬 Nuevo mensaje de soporte',
    cuerpo: texto ? `${telefono}: ${texto}` : `${telefono} te mandó una foto`,
    url: '/admin/mensajes',
    tag: 'chat-admin',
  });

  await enviarATodos(snap.docs, payload);
}

// Se llama cuando el admin marca un pedido como "entregada" — le avisa al
// tenant que su canción ya está lista, aunque no tenga la app abierta.
export async function avisarCancionLista(telefono: string, cancionBase: string): Promise<void> {
  if (!process.env.VAPID_PRIVATE_KEY) return;
  configurar();

  const db = getDb();
  const snap = await db.collection(COLLECTION_TENANTS).where('telefono', '==', telefono).get();
  if (snap.empty) return;

  const payload = JSON.stringify({
    titulo: '🎉 ¡Tu canción está lista!',
    cuerpo: `Ya podés escuchar "${cancionBase}" desde tu cuenta.`,
    url: '/dashboard',
    tag: 'cancion-lista',
  });

  await enviarATodos(snap.docs, payload);
}
