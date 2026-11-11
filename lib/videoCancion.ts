import crypto from 'node:crypto';
import { getDb, getStorageBucket } from '@/lib/firebaseService';

// Solicitudes de /video-para-tu-cancion: quien tiene una canción manda el audio y las fotos de los protagonistas
// para recibir gratis una muestra de 20 segundos. Los archivos quedan privados en Storage y solo se abren con
// enlaces firmados (en el correo de aviso y en /admin/videos-cancion).
//   videos_cancion/{id}: { nombre, whatsapp, cancion, historia, protagonistas, estilo, fecha, audio, fotos[], estado, creado }
const COLECCION = 'videos_cancion';
const LIMITE = 'videos_cancion_limite';
// Tigo y Claro hacen que muchos clientes compartan la misma IP: por conexión el tope es alto (solo frena
// robots) y el límite real es por número de WhatsApp, que sí identifica a cada persona.
const MAX_POR_IP = 20;
const MAX_POR_WHATSAPP = 3;
const TIPOS: Record<string, string> = {
  mp3: 'audio/mpeg', mpeg: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg',
  aac: 'audio/aac', flac: 'audio/flac', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
};
export const ESTADOS = ['nuevo', 'contactado', 'muestra enviada', 'pagado', 'entregado', 'descartado'];

export type SolicitudVideo = {
  nombre: string; whatsapp: string; cancion: string; historia: string; protagonistas: string; estilo: string; fecha: string;
};
export type Archivo = { ext: string; datos: Buffer };

// Cuenta por IP y por WhatsApp (guardados como hash) para que nadie llene el almacenamiento.
// Devuelve qué tope se alcanzó hoy, o null si se puede guardar (y entonces cuenta el envío en los dos).
export async function excedioLimite(ip: string, whatsapp: string): Promise<'ip' | 'whatsapp' | null> {
  const dia = new Date().toISOString().slice(0, 10);
  const doc = (clave: string) => getDb().collection(LIMITE).doc(crypto.createHash('sha256').update(`${clave}|${dia}`).digest('hex'));
  const refIp = doc(ip), refWa = doc(`wa:${whatsapp}`);
  const [envIp, envWa] = await Promise.all([refIp.get(), refWa.get()]).then(r => r.map(d => (d.get('envios') as number) || 0));
  if (envWa >= MAX_POR_WHATSAPP) return 'whatsapp';
  if (envIp >= MAX_POR_IP) return 'ip';
  await Promise.all([refIp.set({ envios: envIp + 1, dia }), refWa.set({ envios: envWa + 1, dia })]);
  return null;
}

// La canción ya está en corridos.online (botón «Haz el video de tu canción» de /cancion/[id]): se copia su
// audio dentro de Storage en vez de pedirle al cliente que lo vuelva a subir.
export async function audioDeCancionCompartida(cancionId: string): Promise<{ titulo: string; ruta: string } | null> {
  const doc = await getDb().collection('canciones_compartidas').doc(cancionId).get();
  const d = doc.data();
  if (!d?.storagePath) return null;
  return { titulo: d.titulo as string, ruta: d.storagePath as string };
}

export async function guardarSolicitud(datos: SolicitudVideo, audio: Archivo | { copiarDe: string }, fotos: Archivo[], cancionCompartidaId?: string) {
  const id = crypto.randomUUID();
  const bucket = getStorageBucket();
  // El nombre y el tipo los pone el servidor: nunca se confía en los del archivo que manda el navegador.
  const subir = async (nombre: string, a: Archivo) => {
    const ruta = `${COLECCION}/${id}/${nombre}.${a.ext}`;
    await bucket.file(ruta).save(a.datos, { resumable: false, contentType: TIPOS[a.ext], metadata: { contentDisposition: 'attachment' } });
    return ruta;
  };
  let rutaAudio: string;
  if ('copiarDe' in audio) {
    const ext = audio.copiarDe.split('.').pop()?.toLowerCase() || 'mp3';
    rutaAudio = `${COLECCION}/${id}/audio.${TIPOS[ext] ? ext : 'mp3'}`;
    await bucket.file(audio.copiarDe).copy(bucket.file(rutaAudio));
  } else {
    rutaAudio = await subir('audio', audio);
  }
  const rutasFotos: string[] = [];
  for (const [i, f] of fotos.entries()) rutasFotos.push(await subir(`foto-${i + 1}`, f));
  const solicitud = { ...datos, audio: rutaAudio, fotos: rutasFotos, estado: 'nuevo', creado: new Date().toISOString(), ...(cancionCompartidaId ? { cancionCompartidaId } : {}) };
  await getDb().collection(COLECCION).doc(id).set(solicitud);
  return { id, ...solicitud };
}

export async function enlaceFirmado(ruta: string, horas: number): Promise<string> {
  const [url] = await getStorageBucket().file(ruta).getSignedUrl({ action: 'read', expires: Date.now() + horas * 3600_000 });
  return url;
}

export async function listarSolicitudes() {
  const res = await getDb().collection(COLECCION).orderBy('creado', 'desc').limit(100).get();
  return Promise.all(res.docs.map(async (d) => {
    const s = d.data();
    return { id: d.id, ...s, audioUrl: await enlaceFirmado(s.audio, 2), fotosUrl: await Promise.all((s.fotos as string[]).map((f) => enlaceFirmado(f, 2))) };
  }));
}

export async function cambiarEstado(id: string, estado: string) {
  await getDb().collection(COLECCION).doc(id).update({ estado });
}
