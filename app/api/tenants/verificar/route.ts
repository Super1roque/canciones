import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { normalizarTelefono, telefonoValido, obtenerTenant, conCodigoPais, esCelularHondurasValido } from '@/lib/tenantService';
import { crearSolicitudVerificacion, obtenerVerificacionPendientePorTelefono } from '@/lib/verificacionService';
import { ADMIN_WHATSAPP } from '@/lib/config';
import { avisarNuevaVerificacion } from '@/lib/emailService';

// Reemplaza el registro por SMS (poco confiable con las operadoras locales)
// por una confirmación manual: la persona manda un mensaje de WhatsApp con
// un código desde su propio número, y el admin aprueba viendo que el
// remitente real coincide con el teléfono que declaró acá.
export async function POST(request: Request) {
  try {
    // Si el navegador ya tiene una sesión de tenant válida, no tiene sentido
    // (ni es deseable) mandarlo a re-verificar — eso solo le crea trabajo de
    // más al admin cada vez que alguien ya logueado insiste con el botón.
    const cookieStore = await cookies();
    const telefonoSesion = cookieStore.get('tenant_phone')?.value;
    if (telefonoSesion) {
      const tenantExistente = await obtenerTenant(telefonoSesion);
      if (tenantExistente) {
        return NextResponse.json({ yaLogueado: true });
      }
    }

    const { telefono: rawTelefono } = await request.json();
    const telefono = normalizarTelefono(conCodigoPais(rawTelefono || ''));

    if (!telefonoValido(telefono)) {
      return NextResponse.json({ error: 'Ese número no parece válido' }, { status: 400 });
    }
    if (!esCelularHondurasValido(telefono)) {
      return NextResponse.json({ error: 'Ese no parece un celular de Honduras válido — revisá que tenga 8 dígitos y empiece con 3, 8 o 9' }, { status: 400 });
    }

    // Reusa una solicitud pendiente existente en vez de acumular una nueva
    // cada vez que alguien reintenta con el mismo número — evita llenarle
    // la cola de aprobaciones al admin con pedidos repetidos.
    const pendiente = await obtenerVerificacionPendientePorTelefono(telefono);
    const verificacion = pendiente ?? await crearSolicitudVerificacion(telefono);
    if (!pendiente) void avisarNuevaVerificacion(telefono);

    const mensaje = 'Por favor deme acceso a probar a hacer mi propio corrido';
    const whatsappUrl = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;

    return NextResponse.json({ id: verificacion.id, whatsappUrl }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('crearSolicitudVerificacion:', msg);
    return NextResponse.json({ error: 'Error al crear la solicitud' }, { status: 500 });
  }
}
