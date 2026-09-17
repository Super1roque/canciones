import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { normalizarTelefono, telefonoValido, obtenerTenant } from '@/lib/tenantService';
import { crearSolicitudVerificacion, obtenerVerificacionPendientePorTelefono } from '@/lib/verificacionService';
import { ADMIN_WHATSAPP } from '@/lib/config';
import { avisarNuevaVerificacion } from '@/lib/emailService';

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
function conCodigoPais(raw: string): string {
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
function esCelularHondurasValido(telefono: string): boolean {
  if (!telefono.startsWith('504')) return true;
  return /^[389]\d{7}$/.test(telefono.slice(3));
}

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
