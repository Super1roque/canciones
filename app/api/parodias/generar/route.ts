import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/firebaseService';
import { generarCancionOriginal, generarParodia } from '@/lib/claudeService';
import { validarSesion } from '@/lib/tenantService';
import { COSTO_CANCION } from '@/lib/pedidoService';
import { SIN_SALDO_PEDIR } from '@/lib/promo';

export async function POST(request: Request) {
  try {
    const { cancionId, historia, alcance, ritmo: ritmoPedido } = await request.json();
    // Sin pista elegida: el cliente escribió el ritmo que quiere y se compone una canción original.
    const ritmo = typeof ritmoPedido === 'string' ? ritmoPedido.trim().slice(0, 60) : '';

    if ((!cancionId && !ritmo) || !historia) {
      return NextResponse.json({ error: 'Se requieren una canción (o un ritmo) y la historia' }, { status: 400 });
    }

    // Esta API la usan tanto el admin (sin restricción) como el flujo público
    // /crear-parodia (identificado por la cookie tenant_phone). Si viene de
    // un tenant, no dejamos generar sin saldo — así nadie se salta la
    // pantalla de bloqueo llamando esta ruta directo y nos gasta la cuota de
    // Claude por un pedido que después no puede pagar.
    const cookieStore = await cookies();
    const telefono = cookieStore.get('tenant_phone')?.value;
    if (telefono) {
      const tenant = await validarSesion(telefono, cookieStore.get('tenant_session')?.value);
      if (!tenant) {
        return NextResponse.json({ error: 'Necesitás registrarte con tu número de teléfono' }, { status: 401 });
      }
      const usaGratis = tenant.cancionesGratisUsadas < tenant.cancionesGratisLimite;
      if (!usaGratis && (tenant.saldo ?? 0) < COSTO_CANCION) {
        return NextResponse.json(
          { error: `No te alcanza el saldo. ${SIN_SALDO_PEDIR} para pedir otra canción.` },
          { status: 402 }
        );
      }
    }

    const alcanceValido: 'completa' | 'coro' = alcance === 'coro' ? 'coro' : 'completa';

    // Se permite tanto una historia completa como solo el nombre de una
    // persona (la parodia se adapta a esa persona en ese caso) — el mínimo
    // solo evita envíos vacíos o accidentales, no exige una historia larga.
    if (historia.trim().length < 2) {
      return NextResponse.json(
        { error: 'Escribe una historia o al menos el nombre de la persona' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'API key de Anthropic no configurada. Agrega ANTHROPIC_API_KEY en el archivo .env' },
        { status: 500 }
      );
    }

    if (ritmo) {
      const trimmedRitmo = historia.trim();
      const letra = await generarCancionOriginal(ritmo, trimmedRitmo);
      return NextResponse.json({
        cancion_base: `Canción original — ${ritmo}`,
        estilo: ritmo,
        descripcionEstilo: `Ritmo pedido por el cliente: ${ritmo}`,
        direccionGenerador: '',
        historia: trimmedRitmo,
        parodia: letra,
        modoPrueba: false,
      });
    }

    const db = getDb();
    const doc = await db.collection('canciones').doc(cancionId).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Canción no encontrada' }, { status: 404 });
    }

    const cancion = { id: doc.id, ...doc.data() } as { id: string; nombre: string; estilo: string; descripcionEstilo?: string; direccionGenerador?: string; letra: string };
    const trimmed  = historia.trim();
    const parodia  = await generarParodia(cancion, trimmed, alcanceValido);
    const modoPrueba = trimmed.toLowerCase().startsWith('esta es una prueba');

    return NextResponse.json({
      cancion_base: cancion.nombre,
      estilo: cancion.estilo,
      descripcionEstilo: cancion.descripcionEstilo ?? '',
      direccionGenerador: cancion.direccionGenerador ?? '',
      historia: trimmed,
      parodia,
      modoPrueba,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error generando parodia:', msg);
    return NextResponse.json({ error: 'Error al generar la parodia: ' + msg }, { status: 500 });
  }
}
