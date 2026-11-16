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

export const MAX_COMPROBANTES = 5;   // por canción: evita que alguien llene el almacenamiento con el mismo link
export const MAX_COMPROBANTE_BYTES = 8 * 1024 * 1024;
