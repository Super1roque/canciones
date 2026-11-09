// Lo comparten la página, el formulario y la API: sin nada del servidor, para poder usarlo en el navegador.
export const PRECIO_VIDEO = 'L 550';
export const WHATSAPP_ARMANDO = '50496895978';
export const MENSAJE_WHATSAPP = 'Hola, quiero la muestra gratis del video para mi canción.';
export const MB = 1024 * 1024;
export const MAX_AUDIO = 25 * MB;
export const MAX_FOTO = 8 * MB;
export const MAX_FOTOS = 3;
export const EXT_AUDIO = ['mp3', 'm4a', 'wav', 'ogg', 'opus', 'aac', 'flac', 'mpeg', 'mp4'];
export const EXT_FOTO = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
export const ESTILOS = ['Cinematográfico', 'Caricatura o cómic'];
export const extension = (nombre: string) => nombre.split('.').pop()?.toLowerCase() ?? '';
