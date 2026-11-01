import { registrarCompra, revocarCompra } from '@/lib/accesoAudiolibros';
import { avisarMiembroApoya, avisarVentaAudiolibro } from '@/lib/emailService';
import { darDeBaja, registrarCobro } from '@/lib/miembrosApoya';

export const runtime = 'nodejs';

// Webhook de Hotmart (versión 2.0). En Hotmart: Herramientas → Webhook → URL
// https://corridos.online/api/hotmart/webhook. El "hottok" que muestra Hotmart va en
// la variable HOTMART_HOTTOK de Render: sin él se rechaza todo, para que nadie pueda
// regalarse accesos llamando a esta ruta.
//
// HOTMART_PRODUCTOS asocia cada producto de Hotmart con su audiolibro: "123456:morazan".
// Así un mismo webhook sirve para los próximos libros que se vendan. La membresía mensual
// de /apoya entra igual, con el nombre "apoya" ("789012:apoya").
const DAN_ACCESO = new Set(['PURCHASE_APPROVED', 'PURCHASE_COMPLETE']);
const QUITAN_ACCESO = new Set(['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK', 'PURCHASE_CANCELED']);

function productoLocal(idHotmart: string): string | null {
  for (const par of (process.env.HOTMART_PRODUCTOS || '').split(',')) {
    const [id, nombre] = par.split(':').map((s) => s.trim());
    if (id && nombre && id === idHotmart) return nombre;
  }
  return null;
}

export async function POST(request: Request) {
  const hottok = process.env.HOTMART_HOTTOK;
  const cuerpo = await request.json().catch(() => null);
  const recibido = request.headers.get('x-hotmart-hottok') || cuerpo?.hottok;
  if (!hottok || recibido !== hottok) {
    return new Response('No autorizado', { status: 401 });
  }

  const evento: string = cuerpo?.event || '';
  const datos = cuerpo?.data || {};
  const transaccion: string | undefined = datos.purchase?.transaction;
  const producto = productoLocal(String(datos.product?.id ?? ''));
  if (producto === 'apoya') return membresia(evento, datos);
  // Responder 200 a lo que no nos toca: si no, Hotmart lo reintenta una y otra vez.
  if (!transaccion || !producto) {
    return Response.json({ ok: true, ignorado: true });
  }

  try {
    if (DAN_ACCESO.has(evento)) {
      const email: string = datos.buyer?.email || '';
      if (!email) return Response.json({ ok: true, ignorado: true });
      const { nueva } = await registrarCompra({
        producto,
        transaccion,
        email,
        nombre: datos.buyer?.name || '',
        evento,
      });
      if (nueva) await avisarVentaAudiolibro(producto, email, datos.purchase?.price?.value, datos.purchase?.price?.currency_value);
    } else if (QUITAN_ACCESO.has(evento)) {
      await revocarCompra(transaccion, evento);
    }
    return Response.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('hotmart/webhook:', evento, transaccion, msg);
    // 500 para que Hotmart vuelva a intentarlo más tarde.
    return new Response('Error', { status: 500 });
  }
}

// Suscripción mensual de /apoya. Cada mes llega un PURCHASE_APPROVED nuevo con el mismo
// código de suscriptor; la cancelación llega como SUBSCRIPTION_CANCELLATION, sin compra.
async function membresia(evento: string, datos: any) {
  const suscriptor: string | undefined = datos.subscription?.subscriber?.code || datos.subscriber?.code;
  if (!suscriptor) return Response.json({ ok: true, ignorado: true });
  try {
    if (DAN_ACCESO.has(evento)) {
      const miembro = {
        email: datos.buyer?.email || '',
        nombre: datos.buyer?.name || '',
        telefono: datos.buyer?.checkout_phone || '',
      };
      const { nuevo } = await registrarCobro({ suscriptor, evento, ...miembro });
      if (nuevo) await avisarMiembroApoya('alta', miembro);
    } else if (QUITAN_ACCESO.has(evento) || evento === 'SUBSCRIPTION_CANCELLATION') {
      const miembro = await darDeBaja(suscriptor, evento);
      const motivo = evento === 'SUBSCRIPTION_CANCELLATION' ? 'canceló la renovación' : evento === 'PURCHASE_REFUNDED' ? 'reembolso' : 'contracargo o cancelación del pago';
      if (miembro) await avisarMiembroApoya('baja', miembro, motivo);
    }
    return Response.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('hotmart/webhook (apoya):', evento, suscriptor, msg);
    return new Response('Error', { status: 500 });
  }
}
