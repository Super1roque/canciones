import admin from 'firebase-admin';
import { getDb } from './firebaseService';

const COLLECTION = 'tenants';

export interface UltimaParodia {
  cancion_base: string;
  estilo: string;
  descripcionEstilo: string;
  direccionGenerador: string;
  historia: string;
  parodia: string;
  fecha: string;
}

export interface Tenant {
  telefono: string;
  fechaRegistro: string;
  cancionesGratisUsadas: number;
  cancionesGratisLimite: number;
  saldo: number;
  ultimaParodia?: UltimaParodia;
  onboardingVisto?: boolean;
}

// Deja solo dígitos — así "9999-8888", "+504 9999 8888" y "99998888" quedan
// todos como el mismo tenant en vez de crear duplicados por formato.
export function normalizarTelefono(raw: string): string {
  return (raw || '').replace(/\D/g, '');
}

export function telefonoValido(telefono: string): boolean {
  return telefono.length >= 8;
}

// Producto pensado para Honduras — si no escriben un +código, se asume 504.
// Sin esto, el mismo número quedaría guardado distinto según cómo lo haya
// tipeado la persona ("9999-8888" vs "+504 9999 8888"), partiendo en dos
// tenants lo que debería ser la misma cuenta.
//
// Los números de Honduras son de 8 dígitos — si ya viene más largo (ej. un
// hondureño en EE. UU. escribiendo su número de allá) asumimos que ya trae
// su propio código de país y no le pisamos un "504" encima, aunque no haya
// puesto el "+" (eso dejaba números como "865-604-9903" convertidos en
// basura tipo "5048656049903").
export function conCodigoPais(raw: string): string {
  const limpio = raw.trim();
  if (limpio.startsWith('+')) return limpio;
  const soloDigitos = limpio.replace(/\D/g, '');
  if (soloDigitos.length > 8) return limpio;
  return '504' + limpio;
}

// Los celulares de Honduras son 8 dígitos y siempre empiezan con 3, 8 o 9
// — filtra typos evidentes ("999-888", un dígito de más, etc.) antes de
// crear ninguna solicitud o mandar el correo de aviso. Solo aplica cuando
// el número terminó siendo tratado como de Honduras (504 + 8 dígitos); un
// número extranjero más largo no pasa por acá.
export function esCelularHondurasValido(telefono: string): boolean {
  if (!telefono.startsWith('504')) return true;
  return /^[389]\d{7}$/.test(telefono.slice(3));
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
    saldo: 0,
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

// Se usa cuando el admin aprueba una recarga — solo suma, sin validar nada.
export async function agregarSaldo(telefono: string, monto: number): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION).doc(telefono).update({
    saldo: admin.firestore.FieldValue.increment(monto),
  });
}

// Se guarda al enviar un pedido — deja que el tenant arranque su próxima
// canción desde acá en vez de escribir la historia de cero, sin gastar de
// nuevo en la IA solo para volver a ver lo que ya tenía.
export async function guardarUltimaParodia(telefono: string, datos: Omit<UltimaParodia, 'fecha'>): Promise<void> {
  const db = getDb();
  const ultimaParodia: UltimaParodia = { ...datos, fecha: new Date().toISOString() };
  await db.collection(COLLECTION).doc(telefono).update({ ultimaParodia });
}

// Para el panel de admin — ordenado por fecha de registro, más reciente
// primero, así lo último que pasó queda arriba sin tener que buscarlo.
export async function listarTodosTenants(): Promise<Tenant[]> {
  const db = getDb();
  const snap = await db.collection(COLLECTION).get();
  return snap.docs
    .map(d => d.data() as Tenant)
    .sort((a, b) => (b.fechaRegistro || '').localeCompare(a.fechaRegistro || ''));
}

// Se llama apenas el tenant cierra el video de inducción — así no vuelve a
// aparecer en visitas futuras, ni en otra pestaña/dispositivo (a diferencia
// de guardarlo solo en localStorage, que es por navegador).
export async function marcarOnboardingVisto(telefono: string): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION).doc(telefono).update({ onboardingVisto: true });
}

// Transacción (no un simple increment negativo) porque acá sí hay que
// verificar el saldo antes de descontarlo — evita que dos pedidos
// simultáneos dejen el saldo en negativo.
export async function descontarSaldo(telefono: string, monto: number): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(telefono);
  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const saldoActual = (doc.data() as Tenant | undefined)?.saldo ?? 0;
    if (saldoActual < monto) throw new Error('SALDO_INSUFICIENTE');
    tx.update(ref, { saldo: admin.firestore.FieldValue.increment(-monto) });
  });
}
