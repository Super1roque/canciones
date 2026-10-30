import { registrarCompra, revocarCompra } from '@/lib/accesoAudiolibros';
import { avisarVentaAudiolibro } from '@/lib/emailService';

export const runtime = 'nodejs';

// Webhook de Hotmart (versión 2.0). En Hotmart: Herramientas → Webhook → URL
// https://corridos.online/api/hotmart/webhook. El "hottok" que muestra Hotmart va en
// la variable HOTMART_HOTTOK de Render: sin él se rechaza todo, para que nadie pueda
// regalarse accesos llamando a esta ruta.
//
// HOTMART_PRODUCTOS asocia cada producto de Hotmart con su audiolibro: "123456:morazan".
// Así un mismo webhook sirve para los próximos libros que se vendan.
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
