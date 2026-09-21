import { NextResponse } from 'next/server';
import { normalizarTelefono, telefonoValido, conCodigoPais, esCelularHondurasValido, obtenerOCrearTenant } from '@/lib/tenantService';
import { crearSolicitudVerificacion, resolverVerificacion } from '@/lib/verificacionService';

// Fast-track para prospectos que ya escribieron por WhatsApp (ej. desde el
// anuncio): el admin da de alta la cuenta directo con el número que ya
// tiene confirmado a mano, sin que la persona tenga que pasar por el
// formulario de /  ni esperar la aprobación normal. Genera un código nuevo
// siempre, incluso si el teléfono ya era tenant — sirve tanto para un alta
// nueva como para reenviar un código fresco a alguien que perdió el suyo.
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

    const solicitud = await crearSolicitudVerificacion(telefono);
    const verificacion = await resolverVerificacion(solicitud.id, true);
    await obtenerOCrearTenant(telefono);

    return NextResponse.json({ telefono, codigo: verificacion.codigo });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('alta-rapida:', msg);
    return NextResponse.json({ error: 'Error al crear la cuenta' }, { status: 500 });
  }
}
