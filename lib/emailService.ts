import { Resend } from 'resend';
import { enlaceFirmado, type SolicitudVideo } from '@/lib/videoCancion';

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

export async function avisarVentaAudiolibro(
  producto: string,
  comprador: string,
  precio?: number,
  moneda?: string,
  // Dónde se abre el libro, si no es corridos.online/<producto> (ej. «historias/copan-ruinas»).
  ruta: string = producto,
): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  try {
    const { error } = await resend.emails.send({
      from: 'Canciones <onboarding@resend.dev>',
      to: ADMIN_EMAIL,
      subject: `🎧 Nueva venta en Hotmart — ${producto}`,
      html: `
        <p>Se vendió el audiolibro <strong>${producto}</strong>.</p>
        <ul>
          <li><strong>Comprador:</strong> ${comprador}</li>
          ${precio ? `<li><strong>Precio:</strong> ${precio} ${moneda || ''}</li>` : ''}
        </ul>
        <p>El acceso ya quedó activo: el comprador lo abre en corridos.online/${ruta} con su correo.</p>
      `,
    });
    if (error) console.error('Resend devolvió un error al avisar de la venta:', error);
  } catch (e) {
    console.error('avisarVentaAudiolibro falló:', e);
  }
}

// Altas y bajas de la membresía de /apoya: Armando agrega o saca a la persona del grupo de WhatsApp.
export async function avisarMiembroApoya(
  tipo: 'alta' | 'baja',
  miembro: { nombre: string; email: string; telefono: string },
  motivo?: string,
): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const datos = `
    <ul>
      <li><strong>Nombre:</strong> ${esc(miembro.nombre || '—')}</li>
      <li><strong>Correo:</strong> ${esc(miembro.email || '—')}</li>
      <li><strong>Teléfono:</strong> ${esc(miembro.telefono || '—')}</li>
    </ul>`;
  try {
    const { error } = await resend.emails.send({
      from: 'Canciones <onboarding@resend.dev>',
      to: ADMIN_EMAIL,
      subject: tipo === 'alta' ? `🙌 Nuevo miembro — ${miembro.nombre || miembro.email}` : `👋 Baja de miembro — ${miembro.nombre || miembro.email}`,
      html:
        tipo === 'alta'
          ? `<p>Alguien se hizo miembro en corridos.online/apoya.</p>${datos}
             <p>Cuando pida entrar al grupo de WhatsApp, apruébalo si el número coincide.</p>`
          : `<p>Un miembro dejó la membresía${motivo ? ` (${esc(motivo)})` : ''}.</p>${datos}
             <p>Si canceló la renovación, ya pagó su mes en curso: sácalo del grupo cuando ese mes termine.
             Si fue reembolso o contracargo, sácalo ya.</p>`,
    });
    if (error) console.error('Resend devolvió un error al avisar del miembro:', error);
  } catch (e) {
    console.error('avisarMiembroApoya falló:', e);
  }
}

export async function avisarNuevaVerificacion(telefono: string): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  try {
    const { error } = await resend.emails.send({
      from: 'Canciones <onboarding@resend.dev>',
      to: ADMIN_EMAIL,
      subject: `Nueva verificación de teléfono — ${telefono}`,
      html: `
        <p>El número <strong>${telefono}</strong> pidió verificarse y va a mandarte un código por WhatsApp.</p>
        <p>Aprobalo solo si el mensaje de WhatsApp llegó de ese mismo número.</p>
        <p><a href="https://corridos.online/admin/pedidos">Revisar en el panel de admin →</a></p>
      `,
    });
    if (error) console.error('Resend devolvió un error al avisar de la verificación:', error);
  } catch (e) {
    console.error('avisarNuevaVerificacion falló:', e);
  }
}

// Solicitud de muestra gratis en /video-para-tu-cancion. Los enlaces firmados duran 7 días; después, el panel genera otros.
export async function avisarSolicitudVideo(s: SolicitudVideo & { audio: string; fotos: string[] }): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  try {
    const horas = 7 * 24;
    const audio = await enlaceFirmado(s.audio, horas);
    const fotos = await Promise.all(s.fotos.map((f) => enlaceFirmado(f, horas)));
    const saludo = encodeURIComponent(`Hola, ${s.nombre}. Soy Armando. Recibí tu canción «${s.cancion}» y te voy a preparar tu muestra gratis de 20 segundos.`);
    const { error } = await resend.emails.send({
      from: 'Canciones <onboarding@resend.dev>',
      to: ADMIN_EMAIL,
      subject: `🎬 Nueva canción para video — ${s.nombre.replace(/[\r\n]+/g, ' ')}`,
      html: `
        <p><a href="https://wa.me/${s.whatsapp}?text=${saludo}"><strong>💬 Escribirle por WhatsApp (+${s.whatsapp})</strong></a></p>
        <ul>
          <li><strong>Nombre:</strong> ${esc(s.nombre)}</li>
          <li><strong>Canción:</strong> ${esc(s.cancion)}</li>
          <li><strong>Estilo:</strong> ${esc(s.estilo)}</li>
          <li><strong>Para cuándo:</strong> ${esc(s.fecha || '—')}</li>
        </ul>
        <p><strong>De qué trata:</strong><br>${esc(s.historia)}</p>
        <p><strong>Protagonistas:</strong><br>${esc(s.protagonistas || '—')}</p>
        <p><a href="${esc(audio)}">🎵 Descargar el audio</a></p>
        ${fotos.map((f, i) => `<p><a href="${esc(f)}">📷 Foto ${i + 1}</a></p>`).join('') || '<p>Sin fotos.</p>'}
        <p>Confirmó tener derecho a usar la canción y el permiso de las personas que aparecen.</p>
        <p><a href="https://corridos.online/admin/videos-cancion">Ver todas las solicitudes →</a></p>
      `,
    });
    if (error) console.error('Resend devolvió un error al avisar de la solicitud de video:', error);
  } catch (e) {
    console.error('avisarSolicitudVideo falló:', e);
  }
}
