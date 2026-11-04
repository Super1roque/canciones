import crypto from 'node:crypto';
import { getDb } from '@/lib/firebaseService';

// Membresía mensual de /apoya (suscripción de Hotmart). El miembro entra al grupo privado de WhatsApp
// (Armando lo aprueba a mano con los datos que le llegan por correo) y además escucha completas las
// radionovelas (/radionovelas): las abre en su navegador con el correo con que paga, sin contraseña.
// Esto lleva la cuenta de quién está activo, para avisar altas y bajas una vez y para dar ese acceso.
//
// Un documento por suscriptor de Hotmart (las renovaciones mensuales traen el mismo código):
//   { email, nombre, telefono, estado: 'activo' | 'baja', evento, cobros, token?, creado, actualizado }
// El token (aleatorio, va en la cookie en lugar del correo) se crea la primera vez que el miembro abre
// algo en el sitio. El acceso se comprueba en cada pedido: cuando hay baja, deja de valer solo.
const COLECCION = 'miembros_apoya';
export const COOKIE_MIEMBRO = 'miembro_apoya';

// La página muestra el botón de pago solo cuando el checkout está configurado en Render.
export function checkoutApoya(): string | null {
  return process.env.APOYA_HOTMART_CHECKOUT || null;
}

// Enlace de invitación del grupo de WhatsApp, que se muestra al volver de Hotmart.
export function grupoApoya(): string | null {
  return process.env.APOYA_WHATSAPP_GRUPO || null;
}

// Devuelve si el suscriptor es nuevo (o vuelve después de una baja), para avisar solo en ese caso.
export async function registrarCobro(datos: {
  suscriptor: string;
  email: string;
  nombre: string;
  telefono: string;
  evento: string;
}): Promise<{ nuevo: boolean; cobros: number }> {
  const ref = getDb().collection(COLECCION).doc(datos.suscriptor);
  const actual = await ref.get();
  const ahora = new Date().toISOString();
  if (actual.exists) {
    const volvio = actual.get('estado') !== 'activo';
    // APPROVED y luego COMPLETE llegan por el mismo cobro: solo APPROVED suma uno.
    const cobros = (actual.get('cobros') || 0) + (datos.evento === 'PURCHASE_APPROVED' ? 1 : 0);
    await ref.update({ estado: 'activo', evento: datos.evento, cobros, actualizado: ahora });
    return { nuevo: volvio, cobros };
  }
  await ref.set({
    email: datos.email.trim().toLowerCase(),
    nombre: datos.nombre,
    telefono: datos.telefono,
    estado: 'activo',
    evento: datos.evento,
    cobros: 1,
    creado: ahora,
    actualizado: ahora,
  });
  return { nuevo: true, cobros: 1 };
}

// Devuelve los datos del miembro si estaba activo (para avisar la baja una sola vez).
export async function darDeBaja(suscriptor: string, evento: string) {
  const ref = getDb().collection(COLECCION).doc(suscriptor);
  const actual = await ref.get();
  if (!actual.exists || actual.get('estado') !== 'activo') return null;
  await ref.update({ estado: 'baja', evento, actualizado: new Date().toISOString() });
  return { email: actual.get('email') as string, nombre: actual.get('nombre') as string, telefono: actual.get('telefono') as string };
}

// Token del miembro activo con ese correo (lo crea si todavía no tiene), o null si no es miembro activo.
export async function tokenMiembro(email: string): Promise<string | null> {
  const snap = await getDb().collection(COLECCION).where('email', '==', email.trim().toLowerCase()).get();
  const doc = snap.docs.find((d) => d.get('estado') === 'activo');
  if (!doc) return null;
  const actual = doc.get('token') as string | undefined;
  if (actual) return actual;
  const token = crypto.randomBytes(24).toString('hex');
  await doc.ref.update({ token, actualizado: new Date().toISOString() });
  return token;
}

export async function miembroActivo(token: string | undefined): Promise<boolean> {
  if (!token || !/^[0-9a-f]{48}$/.test(token)) return false;
  const snap = await getDb().collection(COLECCION).where('token', '==', token).limit(1).get();
  return !!snap.docs[0] && snap.docs[0].get('estado') === 'activo';
}
