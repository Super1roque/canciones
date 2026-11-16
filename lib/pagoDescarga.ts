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

// Descarga gratis por compartir (16 nov 2026): cada teléfono que comparte la canción (Facebook, estado o chat de
// WhatsApp, o el botón de compartir) lo hace con su link personal ?c=<código>, y la descarga se desbloquea cuando
// VISITAS_PARA_DESBLOQUEO personas distintas —no el mismo teléfono que la compartió— la abren con un link compartido.
// Ni Facebook ni WhatsApp le avisan a una web si alguien publicó: se cuentan las visitas reales que llegan.
export const VISITAS_PARA_DESBLOQUEO = 3;
export const urlCompartida = (id: string, codigo: string) => `https://corridos.online/cancion/${id}?c=${codigo}`;
export const CODIGO_VALIDO = /^[a-z0-9]{6,16}$/;

export const MAX_COMPROBANTES = 5;   // por canción: evita que alguien llene el almacenamiento con el mismo link
export const MAX_COMPROBANTE_BYTES = 8 * 1024 * 1024;
