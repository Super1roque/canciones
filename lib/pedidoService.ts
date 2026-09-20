import { getDb } from './firebaseService';
import { obtenerTenant, incrementarUsoTenant, descontarSaldo, guardarUltimaParodia } from './tenantService';

const COLLECTION = 'pedidos';

export const COSTO_CANCION = 100;

export interface Pedido {
  id: string;
  cancion_base: string;
  estilo: string;
  descripcionEstilo: string;
  direccionGenerador: string;
  historia: string;
  parodia: string;
  telefono: string;
  fecha: string;
  estado: 'pendiente' | 'entregada';
  costo: number;
  cancionCompartidaId?: string;
}

type NuevoPedidoInput = {
  cancion_base: string;
  estilo?: string;
  descripcionEstilo?: string;
  direccionGenerador?: string;
  historia: string;
  parodia: string;
};

function toPedido(id: string, data: FirebaseFirestore.DocumentData): Pedido {
  return {
    id,
    cancion_base: data.cancion_base,
    estilo: data.estilo ?? '',
    descripcionEstilo: data.descripcionEstilo ?? '',
    direccionGenerador: data.direccionGenerador ?? '',
    historia: data.historia,
    parodia: data.parodia,
    telefono: data.telefono,
    fecha: data.fecha,
    // Pedidos guardados antes de que existiera cobro/estado quedan como
    // "pendiente" y "gratis" — no hace falta migrar datos viejos.
    estado: data.estado ?? 'pendiente',
    costo: data.costo ?? 0,
    cancionCompartidaId: data.cancionCompartidaId,
  };
}

// Cobra el pedido (gratis si todavía tiene cuota, si no descuenta el costo
// de su saldo) y recién si eso funciona lo guarda — así nunca queda un
// pedido creado sin haberse cobrado.
export async function crearPedido(telefono: string, input: NuevoPedidoInput): Promise<Pedido> {
  const tenant = await obtenerTenant(telefono);
  if (!tenant) throw new Error('TENANT_NO_ENCONTRADO');

  const usaGratis = tenant.cancionesGratisUsadas < tenant.cancionesGratisLimite;
  const costo = usaGratis ? 0 : COSTO_CANCION;

  if (!usaGratis) {
    await descontarSaldo(telefono, COSTO_CANCION);
  }

  const db = getDb();
  const nuevo = {
    cancion_base: input.cancion_base,
    estilo: input.estilo ?? '',
    descripcionEstilo: input.descripcionEstilo ?? '',
    direccionGenerador: input.direccionGenerador ?? '',
    historia: input.historia,
    parodia: input.parodia,
    telefono,
    fecha: new Date().toISOString(),
    estado: 'pendiente' as const,
    costo,
  };

  const docRef = await db.collection(COLLECTION).add(nuevo);
  if (usaGratis) await incrementarUsoTenant(telefono);
  await guardarUltimaParodia(telefono, {
    cancion_base: input.cancion_base,
    estilo: input.estilo ?? '',
    descripcionEstilo: input.descripcionEstilo ?? '',
    direccionGenerador: input.direccionGenerador ?? '',
    historia: input.historia,
    parodia: input.parodia,
  });

  return { id: docRef.id, ...nuevo };
}

// Ordenado en memoria (no con orderBy de Firestore) para no depender de un
// índice compuesto por "telefono" — el volumen de pedidos es chico.
export async function listarPedidosPorTelefono(telefono: string): Promise<Pedido[]> {
  const db = getDb();
  const snap = await db.collection(COLLECTION).where('telefono', '==', telefono).get();
  return snap.docs
    .map(d => toPedido(d.id, d.data()))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export async function listarTodosPedidos(): Promise<Pedido[]> {
  const db = getDb();
  const snap = await db.collection(COLLECTION).get();
  return snap.docs
    .map(d => toPedido(d.id, d.data()))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export async function marcarPedidoEntregado(id: string): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION).doc(id).update({ estado: 'entregada' });
}

// Guarda en el pedido el id del doc de `canciones_compartidas` que le
// corresponde, para que el tenant pueda volver a escucharla desde su
// dashboard sin depender de que el admin le reenvíe el link.
export async function vincularCancionCompartida(pedidoId: string, cancionCompartidaId: string): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION).doc(pedidoId).update({ cancionCompartidaId });
}
