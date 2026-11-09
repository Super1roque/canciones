import crypto from 'node:crypto';
import { getDb, getStorageBucket } from '@/lib/firebaseService';

// Solicitudes de /video-para-tu-cancion: quien tiene una canción manda el audio y las fotos de los protagonistas
// para recibir gratis una muestra de 20 segundos. Los archivos quedan privados en Storage y solo se abren con
// enlaces firmados (en el correo de aviso y en /admin/videos-cancion).
//   videos_cancion/{id}: { nombre, whatsapp, cancion, historia, protagonistas, estilo, fecha, audio, fotos[], estado, creado }
const COLECCION = 'videos_cancion';
const LIMITE = 'videos_cancion_limite';
const MAX_POR_DIA = 5;
const TIPOS: Record<string, string> = {
  mp3: 'audio/mpeg', mpeg: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg',
  aac: 'audio/aac', flac: 'audio/flac', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
};
export const ESTADOS = ['nuevo', 'contactado', 'muestra enviada', 'pagado', 'entregado', 'descartado'];

export type SolicitudVideo = {
  nombre: string; whatsapp: string; cancion: string; historia: string; protagonistas: string; estilo: string; fecha: string;
};
export type Archivo = { ext: string; datos: Buffer };

// Cuenta por IP (guardada como hash) para que nadie llene el almacenamiento: true si ya llegó al tope de hoy.
export async function excedioLimite(ip: string): Promise<boolean> {
  const dia = new Date().toISOString().slice(0, 10);
  const ref = getDb().collection(LIMITE).doc(crypto.createHash('sha256').update(`${ip}|${dia}`).digest('hex'));
  const envios = ((await ref.get()).get('envios') as number) || 0;
  if (envios >= MAX_POR_DIA) return true;
  await ref.set({ envios: envios + 1, dia });
  return false;
}

export async function guardarSolicitud(datos: SolicitudVideo, audio: Archivo, fotos: Archivo[]) {
  const id = crypto.randomUUID();
  const bucket = getStorageBucket();
  // El nombre y el tipo los pone el servidor: nunca se confía en los del archivo que manda el navegador.
  const subir = async (nombre: string, a: Archivo) => {
    const ruta = `${COLECCION}/${id}/${nombre}.${a.ext}`;
    await bucket.file(ruta).save(a.datos, { resumable: false, contentType: TIPOS[a.ext], metadata: { contentDisposition: 'attachment' } });
    return ruta;
  };
  const rutaAudio = await subir('audio', audio);
  const rutasFotos: string[] = [];
  for (const [i, f] of fotos.entries()) rutasFotos.push(await subir(`foto-${i + 1}`, f));
  const solicitud = { ...datos, audio: rutaAudio, fotos: rutasFotos, estado: 'nuevo', creado: new Date().toISOString() };
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
