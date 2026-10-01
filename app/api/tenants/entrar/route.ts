import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { normalizarTelefono, conCodigoPais, telefonoValido, esCelularHondurasValido, iniciarSesion, obtenerTenant } from '@/lib/tenantService';
import { ADMIN_WHATSAPP } from '@/lib/config';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // ~180 días

function formatTelefono(digits: string): string {
  if (digits.startsWith('504') && digits.length === 11) return digits.slice(3);
  return digits;
}

// Reemplaza todo el viejo trámite de confirmar por WhatsApp + esperar
// aprobación: alcanza con el número para entrar al toque. El único freno es
// que ese número ya tenga una sesión abierta en otro lado (ver
// iniciarSesion en lib/tenantService.ts) — ahí se bloquea en vez de
// pisarla, y el admin la libera a mano desde /admin/tenants si hace falta.
export async function POST(request: Request) {
  try {
    const { telefono: rawTelefono } = await request.json();
    const telefono = normalizarTelefono(conCodigoPais(rawTelefono || ''));

    if (!telefonoValido(telefono)) {
      return NextResponse.json({ error: 'Ese número no parece válido' }, { status: 400 });
    }
    if (!esCelularHondurasValido(telefono)) {
      return NextResponse.json({ error: 'Ese no parece un celular de Honduras válido — revisá que tenga 8 dígitos y empiece con 3, 8 o 9' }, { status: 400 });
    }

    // Un dispositivo solo funciona con un número a la vez — si este mismo
    // navegador ya tiene una sesión activa de OTRO número, hay que cerrar
    // esa primero (botón "Cerrar sesión") en vez de pisarla silenciosamente
    // entrando con uno distinto; si no, el número viejo quedaría con una
    // sesión "activa" fantasma que nadie va a volver a usar desde ahí,
    // bloqueándole la entrada a su verdadero dueño en otro aparato.
    const cookieStore = await cookies();
    const telefonoDispositivo = cookieStore.get('tenant_phone')?.value;
    const sesionDispositivo = cookieStore.get('tenant_session')?.value;
    if (telefonoDispositivo && telefonoDispositivo !== telefono) {
      const tenantActual = await obtenerTenant(telefonoDispositivo);
      if (tenantActual?.sesionId && tenantActual.sesionId === sesionDispositivo) {
        return NextResponse.json({
          error: `Este dispositivo ya tiene una sesión abierta con el número ${formatTelefono(telefonoDispositivo)}. Cerrá esa sesión antes de entrar con otro número.`,
        }, { status: 409 });
      }
    }

    const resultado = await iniciarSesion(telefono, sesionDispositivo);
    if (!resultado.ok) {
      // Sin link a /dashboard#soporte a propósito: si está bloqueado, no
      // puede entrar a verlo — WhatsApp es el único canal que le queda.
      const mensaje = `Hola, quiero entrar a mi cuenta de Canciones con el número ${telefono} pero me dice que ya hay una sesión abierta en otro lado. ¿Me ayudan a liberarla?`;
      const whatsappUrl = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
      return NextResponse.json({
        error: 'Ya hay una sesión abierta con este número en otro dispositivo.',
        whatsappUrl,
      }, { status: 409 });
    }

    const res = NextResponse.json({ ok: true });
    const opcionesCookie = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    };
    res.cookies.set('tenant_phone', telefono, opcionesCookie);
    res.cookies.set('tenant_session', resultado.sesionId, opcionesCookie);
    return res;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('tenants/entrar:', msg);
    return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 500 });
  }
}
