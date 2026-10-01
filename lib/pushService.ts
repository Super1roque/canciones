import webpush from 'web-push';
import { getDb } from './firebaseService';

const COLLECTION = 'push_suscripciones';

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

// Una suscripción por navegador/dispositivo donde el admin haya tocado
// "Activar notificaciones" — puede haber varias (celular + laptop), todas
// reciben el aviso. El endpoint de la suscripción es único por navegador,
// así que sirve de id para no duplicar si se vuelve a suscribir el mismo.
export async function guardarSuscripcionPush(subscription: webpush.PushSubscription): Promise<void> {
  const db = getDb();
  const id = Buffer.from(subscription.endpoint).toString('base64url').slice(0, 400);
  await db.collection(COLLECTION).doc(id).set({
    subscription,
    fecha: new Date().toISOString(),
  });
}

export async function eliminarSuscripcionPush(endpoint: string): Promise<void> {
  const db = getDb();
  const id = Buffer.from(endpoint).toString('base64url').slice(0, 400);
  await db.collection(COLLECTION).doc(id).delete().catch(() => {});
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
  const snap = await db.collection(COLLECTION).get();
  if (snap.empty) return;

  const payload = JSON.stringify({
    titulo: '💬 Nuevo mensaje de soporte',
    cuerpo: texto ? `${telefono}: ${texto}` : `${telefono} te mandó una foto`,
    url: '/admin/mensajes',
  });

  await Promise.all(snap.docs.map(async (doc) => {
    try {
      // urgency:'high' le pide a FCM que lo trate como prioritario — en
      // Android, eso lo hace más probable que despierte a Chrome aunque el
      // sistema esté en modo ahorro de batería con la pantalla apagada.
      await webpush.sendNotification(doc.data().subscription, payload, { urgency: 'high' });
    } catch (error: unknown) {
      // 410/404 = suscripción vencida (el navegador la invalidó, ej. se
      // desinstaló la PWA) — se borra para no seguir intentando para
      // siempre contra un endpoint muerto.
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await doc.ref.delete().catch(() => {});
      } else {
        console.error('avisarNuevoMensajeAdmin:', error);
      }
    }
  }));
}
