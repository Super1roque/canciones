import fs from 'fs';

export type Orientacion = 'landscape' | 'portrait';

export interface ArchivoVideoPexels {
  link: string;
  width: number;
  height: number;
  quality: string;
  file_type: string;
}

interface RespuestaBusquedaPexels {
  videos: {
    id: number;
    duration: number;
    video_files: ArchivoVideoPexels[];
  }[];
}

// Consultas genéricas de respaldo cuando una búsqueda específica no
// devuelve resultados — mantienen el video andando en vez de fallar toda
// la generación por una sola escena sin metraje disponible.
const CONSULTAS_RESPALDO = [
  'abstract light background',
  'cinematic clouds sky',
  'bokeh lights night',
  'ocean waves slow motion',
  'city lights night',
];

function elegirMejorArchivo(archivos: ArchivoVideoPexels[], orientacion: Orientacion): ArchivoVideoPexels | null {
  const soloMp4 = archivos.filter(a => a.file_type === 'video/mp4');
  if (!soloMp4.length) return null;

  const quiereVertical = orientacion === 'portrait';
  const conOrientacionCorrecta = soloMp4.filter(a =>
    quiereVertical ? a.height >= a.width : a.width >= a.height,
  );
  const candidatos = conOrientacionCorrecta.length ? conOrientacionCorrecta : soloMp4;

  // HD (~1280×720) alcanza y sobra para redes sociales — evita descargar
  // 4K innecesariamente, que alarga mucho el pipeline.
  const OBJETIVO = 1280;
  return candidatos.reduce((mejor, actual) => {
    const dimActual = Math.max(actual.width, actual.height);
    const dimMejor = Math.max(mejor.width, mejor.height);
    const actualEsMejor =
      Math.abs(dimActual - OBJETIVO) < Math.abs(dimMejor - OBJETIVO);
    return actualEsMejor ? actual : mejor;
  }, candidatos[0]);
}

async function buscarVariosUnaVez(
  query: string, orientacion: Orientacion, apiKey: string, cantidad: number,
): Promise<ArchivoVideoPexels[]> {
  const perPage = Math.min(Math.max(cantidad * 2, 6), 80);
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=${orientacion}&per_page=${perPage}`;
  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) {
    console.error(`[pexelsService] búsqueda "${query}" respondió ${res.status}`);
    return [];
  }
  const data = await res.json() as RespuestaBusquedaPexels;
  if (!data.videos?.length) return [];

  // Variedad: arrancamos en un offset al azar dentro de los primeros
  // resultados, para que consultas parecidas entre canciones no siempre
  // devuelvan los mismos clips en el mismo orden.
  const offset = Math.floor(Math.random() * Math.min(data.videos.length, 3));
  const rotados = [...data.videos.slice(offset), ...data.videos.slice(0, offset)];

  const archivos: ArchivoVideoPexels[] = [];
  for (const video of rotados) {
    const archivo = elegirMejorArchivo(video.video_files, orientacion);
    if (archivo) archivos.push(archivo);
    if (archivos.length >= cantidad) break;
  }
  return archivos;
}

// Busca hasta `cantidad` clips DISTINTOS para una misma consulta, con UNA
// sola llamada a la API de búsqueda — así una escena puede cambiar de clip
// en cada línea (para que el video se sienta como que "avanza" con la
// historia) sin gastar una consulta de Pexels por línea. Si la consulta
// directa no alcanza la cantidad pedida, se completa con una versión
// simplificada y, como último recurso, con consultas de respaldo; si aun
// así faltan, se repiten (ciclando) los clips ya encontrados.
export async function buscarClipsPexels(
  query: string, orientacion: Orientacion, apiKey: string, cantidad: number, indiceEscena: number,
): Promise<ArchivoVideoPexels[]> {
  let archivos = await buscarVariosUnaVez(query, orientacion, apiKey, cantidad);

  if (archivos.length < cantidad) {
    const simplificada = query.split(/\s+/).slice(0, 2).join(' ');
    if (simplificada && simplificada !== query) {
      const extra = await buscarVariosUnaVez(simplificada, orientacion, apiKey, cantidad - archivos.length);
      archivos = archivos.concat(extra);
    }
  }
  if (archivos.length < cantidad) {
    const respaldo = CONSULTAS_RESPALDO[indiceEscena % CONSULTAS_RESPALDO.length];
    const extra = await buscarVariosUnaVez(respaldo, orientacion, apiKey, cantidad - archivos.length);
    archivos = archivos.concat(extra);
  }
  if (!archivos.length) return [];

  const base = archivos.slice();
  for (let i = 0; archivos.length < cantidad; i++) {
    archivos.push(base[i % base.length]);
  }
  return archivos.slice(0, cantidad);
}

// Los clips de Pexels pesan varios MB — de vez en cuando el CDN corta la
// conexión a mitad de la descarga (SocketError: "other side closed") sin
// que haya nada mal con el clip en sí. Sin reintento, esa única descarga
// tumbaba la generación de TODO el video. Reintenta hasta 3 veces con
// espera creciente antes de rendirse.
export async function descargarArchivo(url: string, destino: string, intentos = 3): Promise<void> {
  let ultimoError: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`No se pudo descargar el clip de Pexels (${res.status})`);
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(destino, buffer);
      return;
    } catch (err) {
      ultimoError = err;
      if (i < intentos - 1) await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  const causa = ultimoError instanceof Error ? ultimoError.message : String(ultimoError);
  throw new Error(`No se pudo descargar el clip de Pexels tras ${intentos} intentos (${causa})`);
}
