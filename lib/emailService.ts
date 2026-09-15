import { Resend } from 'resend';

const ADMIN_EMAIL = 'super1roque@gmail.com';

// Mismo patrón que RickyMath/Mi Ventita: remitente del dominio de pruebas
// de Resend, que solo puede mandarle correo al dueño de la cuenta — no
// hace falta verificar un dominio propio para este aviso interno.
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error('RESEND_API_KEY no está configurada — no se pudo enviar el aviso');
    return null;
  }
  return new Resend(key);
}

// No debe frenar ni hacer fallar el pedido/recarga si el correo falla —
// por eso cada llamado atrapa sus propios errores y solo los loguea.
export async function avisarNuevoPedido(telefono: string, cancionBase: string): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  try {
    const { error } = await resend.emails.send({
      from: 'Canciones <onboarding@resend.dev>',
      to: ADMIN_EMAIL,
      subject: `Nueva canción pedida — ${telefono}`,
      html: `
        <p>El tenant <strong>${telefono}</strong> pidió una canción y necesita tu atención.</p>
        <ul>
          <li><strong>Pista base:</strong> ${cancionBase}</li>
        </ul>
        <p><a href="https://corridos.online/admin/pedidos">Revisar en el panel de admin →</a></p>
      `,
    });
    if (error) console.error('Resend devolvió un error al avisar del pedido:', error);
  } catch (e) {
    console.error('avisarNuevoPedido falló:', e);
  }
}

export async function avisarNuevaRecarga(telefono: string, monto: number): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  try {
    const { error } = await resend.emails.send({
      from: 'Canciones <onboarding@resend.dev>',
      to: ADMIN_EMAIL,
      subject: `Recarga pendiente de verificar — ${telefono}`,
      html: `
        <p>El tenant <strong>${telefono}</strong> solicitó una recarga y necesita que la verifiques.</p>
        <ul>
          <li><strong>Monto:</strong> L. ${monto}</li>
        </ul>
        <p><a href="https://corridos.online/admin/pedidos">Revisar en el panel de admin →</a></p>
      `,
    });
    if (error) console.error('Resend devolvió un error al avisar de la recarga:', error);
  } catch (e) {
    console.error('avisarNuevaRecarga falló:', e);
  }
}
