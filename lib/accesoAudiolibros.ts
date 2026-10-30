import crypto from 'node:crypto';
import { getDb } from '@/lib/firebaseService';

// Compras de audiolibros hechas en Hotmart. El webhook (/api/hotmart/webhook) crea o
// revoca el acceso; el comprador lo activa en su navegador escribiendo el correo con el
// que pagó, sin contraseña ni cuenta. La cookie guarda un token aleatorio, no el correo.
//
// Un documento por transacción de Hotmart:
//   { producto, email, nombre, estado: 'activo' | 'revocado', token, evento, creado, actualizado }
const COLECCION = 'accesos_audiolibros';
export const COOKIE_MORAZAN = 'acceso_morazan';

// La venta se activa al configurar el enlace del checkout en Render. Mientras no
// exista, /morazan sigue siendo gratuito y completo, como antes.
export function checkoutMorazan(): string | null {
  return process.env.MORAZAN_HOTMART_CHECKOUT || null;
}

function normalizarEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function registrarCompra(datos: {
  producto: string;
  transaccion: string;
  email: string;
  nombre: string;
  evento: string;
}): Promise<{ nueva: boolean }> {
  const ref = getDb().collection(COLECCION).doc(datos.transaccion);
  const actual = await ref.get();
  const ahora = new Date().toISOString();
  if (actual.exists) {
    // Hotmart reenvía eventos (APPROVED y luego COMPLETE): no se cambia el token ya entregado.
    await ref.update({ estado: 'activo', evento: datos.evento, actualizado: ahora });
    return { nueva: false };
  }
  await ref.set({
    producto: datos.producto,
    email: normalizarEmail(datos.email),
    nombre: datos.nombre,
    estado: 'activo',
    token: crypto.randomBytes(24).toString('hex'),
    evento: datos.evento,
    creado: ahora,
    actualizado: ahora,
  });
  return { nueva: true };
}

export async function revocarCompra(transaccion: string, evento: string) {
  const ref = getDb().collection(COLECCION).doc(transaccion);
  if (!(await ref.get()).exists) return;
  await ref.update({ estado: 'revocado', evento, actualizado: new Date().toISOString() });
}

// Token del acceso activo de ese correo para ese producto, o null.
export async function tokenPorEmail(producto: string, email: string): Promise<string | null> {
  const snap = await getDb()
    .collection(COLECCION)
    .where('email', '==', normalizarEmail(email))
    .get();
  const doc = snap.docs.find((d) => d.get('producto') === producto && d.get('estado') === 'activo');
  return doc ? (doc.get('token') as string) : null;
}

export async function tokenValido(producto: string, token: string | undefined): Promise<boolean> {
  if (!token || !/^[0-9a-f]{48}$/.test(token)) return false;
  const snap = await getDb().collection(COLECCION).where('token', '==', token).limit(1).get();
  const doc = snap.docs[0];
  return !!doc && doc.get('producto') === producto && doc.get('estado') === 'activo';
}
