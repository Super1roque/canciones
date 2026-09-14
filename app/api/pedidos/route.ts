import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/firebaseService';
import { obtenerTenant, incrementarUsoTenant } from '@/lib/tenantService';

// Registro de canciones pedidas por clientes desde el flujo público de
// /crear-parodia — colección separada de "parodias" (que es donde el admin
// guarda sus propias creaciones), para no mezclar los pedidos de clientes
// con el trabajo propio.
const COLLECTION = 'pedidos';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const telefono = cookieStore.get('tenant_phone')?.value;

    if (!telefono) {
      return NextResponse.json({ error: 'Necesitás registrarte con tu número de teléfono' }, { status: 401 });
    }

    const tenant = await obtenerTenant(telefono);
    if (!tenant) {
      return NextResponse.json({ error: 'Necesitás registrarte con tu número de teléfono' }, { status: 401 });
    }

    if (tenant.cancionesGratisUsadas >= tenant.cancionesGratisLimite) {
      return NextResponse.json(
        { error: 'Ya usaste tu canción gratis. Muy pronto vas a poder pedir canciones adicionales.' },
        { status: 403 }
      );
    }

    const { cancion_base, estilo, descripcionEstilo, direccionGenerador, historia, parodia } = await request.json();

    if (!cancion_base || !historia || !parodia) {
      return NextResponse.json({ error: 'Faltan datos para enviar el pedido' }, { status: 400 });
    }

    const db = getDb();
    const nuevo = {
      cancion_base,
      estilo:              estilo              ?? '',
      descripcionEstilo:   descripcionEstilo   ?? '',
      direccionGenerador:  direccionGenerador  ?? '',
      historia,
      parodia,
      telefono,
      fecha: new Date().toISOString(),
    };

    const docRef = await db.collection(COLLECTION).add(nuevo);
    await incrementarUsoTenant(telefono);

    return NextResponse.json({ id: docRef.id, ...nuevo }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Firestore guardarPedido:', msg);
    return NextResponse.json({ error: 'Error al enviar el pedido' }, { status: 500 });
  }
}
