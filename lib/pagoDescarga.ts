// Pago directo de la descarga (L 250) por transferencia: la página de la canción muestra la cuenta y la persona sube
// la foto del comprobante ahí mismo, en vez de escribir por WhatsApp y esperar (16 nov 2026: de 113 canciones
// entregadas desde el 11 nov solo se pagó 1 descarga). El número de cuenta no va en el código: se lee de las
// variables BANCO_CUENTA y BANCO_TITULAR (y BANCO_NOMBRE, opcional). Si faltan, la página vuelve al botón de WhatsApp.
export interface DatosBanco {
  banco: string;
  cuenta: string;
  titular: string;
}

export function datosBanco(): DatosBanco | null {
  const cuenta = process.env.BANCO_CUENTA?.trim();
  const titular = process.env.BANCO_TITULAR?.trim();
  if (!cuenta || !titular) return null;
  return { banco: process.env.BANCO_NOMBRE?.trim() || 'Banco Atlántida', cuenta, titular };
}

// Descarga gratis por compartir (16 nov 2026): quien comparte la canción en Facebook con el botón de la página la
// desbloquea cuando VISITAS_FB_PARA_DESBLOQUEO personas distintas la abren desde Facebook. Facebook no le avisa a
// una web si alguien publicó, así que se cuenta lo que sí se puede ver: visitas reales que llegan desde Facebook.
export const VISITAS_FB_PARA_DESBLOQUEO = 2;
export const urlCompartirFacebook = (id: string) => `https://corridos.online/cancion/${id}?c=fb`;

export const MAX_COMPROBANTES = 5;   // por canción: evita que alguien llene el almacenamiento con el mismo link
export const MAX_COMPROBANTE_BYTES = 8 * 1024 * 1024;
