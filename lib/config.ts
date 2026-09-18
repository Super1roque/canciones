// Número de WhatsApp del negocio — a donde llegan las confirmaciones de
// registro y los avisos de recarga. Un solo lugar para no repetirlo en
// cada componente que necesite armar un link de wa.me.
export const ADMIN_WHATSAPP = '50496895978';

// Mensaje que arma el link de wa.me para confirmar una verificación nueva.
// Compartido entre el backend (que arma el link) y la landing (que le
// muestra a la persona, antes de abrirlo, qué es exactamente lo que va a
// mandar) — así nunca quedan desincronizados.
export const MENSAJE_VERIFICACION = 'Por favor deme acceso a probar a hacer mi propio corrido';
