import { NextResponse } from 'next/server';
import { normalizarTelefono, telefonoValido } from '@/lib/tenantService';
import { crearSolicitudVerificacion } from '@/lib/verificacionService';
import { ADMIN_WHATSAPP } from '@/lib/config';

// Producto pensado para Honduras — si no escriben un +código, se asume 504.
// Sin esto, el mismo número quedaría guardado distinto según cómo lo haya
// tipeado la persona ("9999-8888" vs "+504 9999 8888"), partiendo en dos
// tenants lo que debería ser la misma cuenta.
function conCodigoPais(raw: string): string {
  const limpio = raw.trim();
  if (limpio.startsWith('+')) return limpio;
  return '504' + limpio;
}

// Reemplaza el registro por SMS (poco confiable con las operadoras locales)
// por una confirmación manual: la persona manda un mensaje de WhatsApp con
// un código desde su propio número, y el admin aprueba viendo que el
// remitente real coincide con el teléfono que declaró acá.
export async function POST(request: Request) {
  try {
    const { telefono: rawTelefono } = await request.json();
    const telefono = normalizarTelefono(conCodigoPais(rawTelefono || ''));

    if (!telefonoValido(telefono)) {
      return NextResponse.json({ error: 'Ese número no parece válido' }, { status: 400 });
    }

    const verificacion = await crearSolicitudVerificacion(telefono);
    const mensaje = `Hola, quiero confirmar mi registro en Canciones. Mi código es: ${verificacion.codigo}`;
    const whatsappUrl = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;

    return NextResponse.json({ id: verificacion.id, whatsappUrl }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('crearSolicitudVerificacion:', msg);
    return NextResponse.json({ error: 'Error al crear la solicitud' }, { status: 500 });
  }
}
