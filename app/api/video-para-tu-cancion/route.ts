import { NextResponse } from 'next/server';
import { avisarSolicitudVideo } from '@/lib/emailService';
import { audioDeCancionCompartida, excedioLimite, guardarSolicitud, type Archivo } from '@/lib/videoCancion';
import { ESTILOS, EXT_AUDIO, EXT_FOTO, MAX_AUDIO, MAX_FOTO, MAX_FOTOS, MB, extension } from '@/app/video-para-tu-cancion/datos';

const error = (mensaje: string, status = 400) => NextResponse.json({ error: mensaje }, { status });

export async function POST(request: Request) {
  // Se corta antes de leer el cuerpo: el servidor tiene poca memoria.
  if (Number(request.headers.get('content-length') || 0) > MAX_AUDIO + MAX_FOTO * MAX_FOTOS + MB) return error('Los archivos pesan demasiado.', 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error('No se pudo leer el formulario. Intenta de nuevo.');
  }
  const texto = (campo: string, max: number) => String(form.get(campo) ?? '').trim().slice(0, max);
  // Campo invisible: solo lo llenan los robots. Se les responde «listo» sin guardar nada.
  if (texto('sitio', 100)) return NextResponse.json({ ok: true });

  const nombre = texto('nombre', 100);
  const cancion = texto('cancion', 150);
  const historia = texto('historia', 2000);
  const protagonistas = texto('protagonistas', 1000);
  const estilo = texto('estilo', 40);
  const fecha = texto('fecha', 80);
  let whatsapp = texto('whatsapp', 30).replace(/\D/g, '');
  if (whatsapp.length === 8) whatsapp = `504${whatsapp}`;   // número hondureño escrito sin el código de país
  if (!nombre || !cancion || !historia) return error('Faltan datos: nombre, canción y de qué trata.');
  if (whatsapp.length < 10 || whatsapp.length > 15) return error('Revisa tu número de WhatsApp.');
  if (!ESTILOS.includes(estilo)) return error('Elige un estilo.');

  // Si viene de una canción de corridos.online, el audio ya lo tenemos: no se sube de nuevo.
  const cancionCompartidaId = texto('cancionCompartidaId', 80);
  const compartida = cancionCompartidaId ? await audioDeCancionCompartida(cancionCompartidaId) : null;
  if (cancionCompartidaId && !compartida) return error('No encontramos esa canción. Sube el audio a mano.');
  const audio = form.get('audio');
  if (!compartida) {
    if (!(audio instanceof File) || !audio.size) return error('Falta el audio de la canción.');
    if (!EXT_AUDIO.includes(extension(audio.name))) return error('El audio debe ser MP3, M4A, WAV, OGG u OPUS.');
    if (audio.size > MAX_AUDIO) return error('El audio pesa más de 25 MB.');
  }
  const fotos = form.getAll('fotos').filter((f): f is File => f instanceof File && f.size > 0);
  if (fotos.length > MAX_FOTOS) return error(`Puedes enviar hasta ${MAX_FOTOS} fotos.`);
  for (const f of fotos) {
    if (!EXT_FOTO.includes(extension(f.name))) return error('Las fotos deben ser JPG, PNG, WEBP o HEIC.');
    if (f.size > MAX_FOTO) return error('Cada foto debe pesar menos de 8 MB.');
  }

  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'sin-ip';
    const tope = await excedioLimite(ip, whatsapp);
    if (tope === 'whatsapp') return error('Ya recibimos 3 solicitudes de este número hoy. Te escribimos por WhatsApp; si necesitas otra, escríbenos.', 429);
    if (tope === 'ip') return error('Ya recibimos varias solicitudes desde tu conexión. Intenta mañana o escríbenos por WhatsApp.', 429);
    const archivo = async (f: File): Promise<Archivo> => ({ ext: extension(f.name), datos: Buffer.from(await f.arrayBuffer()) });
    const audioSolicitud = compartida ? { copiarDe: compartida.ruta } : await archivo(audio as File);
    const solicitud = await guardarSolicitud({ nombre, whatsapp, cancion, historia, protagonistas, estilo, fecha }, audioSolicitud, await Promise.all(fotos.map(archivo)), compartida ? cancionCompartidaId : undefined);
    await avisarSolicitudVideo(solicitud);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('video-para-tu-cancion:', e instanceof Error ? e.message : e);
    return error('No pudimos guardar tu solicitud. Intenta de nuevo o escríbenos por WhatsApp.', 500);
  }
}
