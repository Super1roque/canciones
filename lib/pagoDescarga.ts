// Descarga gratis por compartir (16 nov 2026). La descarga ya no se cobra: cada teléfono que comparte la canción
// (Facebook, estado o chat de WhatsApp, o el botón de compartir) lo hace con su link personal ?c=<código>, y la descarga
// se desbloquea cuando VISITAS_PARA_DESBLOQUEO personas distintas —no el mismo teléfono que la compartió— la abren con un
// link compartido. Ni Facebook ni WhatsApp le avisan a una web si alguien publicó: se cuentan las visitas reales.
export const VISITAS_PARA_DESBLOQUEO = 3;
export const urlCompartida = (id: string, codigo: string) => `https://corridos.online/cancion/${id}?c=${codigo}`;
export const CODIGO_VALIDO = /^[a-z0-9]{6,16}$/;
