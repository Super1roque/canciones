import admin from 'firebase-admin';
import { getDb } from './firebaseService';

const COLLECTION = 'tenants';

export interface Tenant {
  telefono: string;
  fechaRegistro: string;
  cancionesGratisUsadas: number;
  cancionesGratisLimite: number;
}

// Deja solo dígitos — así "9999-8888", "+504 9999 8888" y "99998888" quedan
// todos como el mismo tenant en vez de crear duplicados por formato.
export function normalizarTelefono(raw: string): string {
  return (raw || '').replace(/\D/g, '');
}

export function telefonoValido(telefono: string): boolean {
  return telefono.length >= 8;
}

export async function obtenerTenant(telefono: string): Promise<Tenant | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).doc(telefono).get();
  if (!doc.exists) return null;
  return doc.data() as Tenant;
}

// get-or-create: la primera vez que un teléfono se registra crea el
// documento; si ya existe, simplemente lo devuelve (así el mismo botón de
// "registrarme" sirve también para que alguien que ya se registró vuelva).
export async function obtenerOCrearTenant(telefono: string): Promise<Tenant> {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(telefono);
  const doc = await ref.get();
  if (doc.exists) return doc.data() as Tenant;

  const nuevo: Tenant = {
    telefono,
    fechaRegistro: new Date().toISOString(),
    cancionesGratisUsadas: 0,
    cancionesGratisLimite: 1,
  };
  await ref.set(nuevo);
  return nuevo;
}

// Incremento atómico — evita una condición de carrera si el mismo tenant
// llega a enviar dos pedidos casi al mismo tiempo.
export async function incrementarUsoTenant(telefono: string): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION).doc(telefono).update({
    cancionesGratisUsadas: admin.firestore.FieldValue.increment(1),
  });
}
