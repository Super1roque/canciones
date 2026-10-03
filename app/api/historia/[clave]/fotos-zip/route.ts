import JSZip from 'jszip';
import { getStorageBucket } from '@/lib/firebaseService';
import { obtenerHistoria, pathFotoHistoria } from '@/lib/miHistoriaService';

export const runtime = 'nodejs';

function extensionPara(contentType: string | undefined): string {
  // El formulario de subida siempre convierte a JPEG antes de mandarla
  // (ver agregarFoto en MiHistoriaApp.tsx) y nunca guardó el contentType
  // junto a la foto — así que sin dato, JPEG es la realidad, no una
  // suposición.
  if (!contentType) return 'jpg';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return 'jpg';
}

// Para poder adjuntar las fotos reales en la misma conversación donde se
// pega el "Exportar para IA" — un prompt de texto no puede "incluir" una
// imagen, así que esto le ahorra a la persona bajar cada foto a mano desde
// la galería.
function nombreArchivo(indice: number, descripcion: string, contentType: string | undefined): string {
  const slug = (descripcion || 'foto')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'foto';
  const num = String(indice + 1).padStart(2, '0');
  return `${num}-${slug}.${extensionPara(contentType)}`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ clave: string }> }) {
  try {
    const { clave } = await params;
    const historia = await obtenerHistoria(clave);
    if (historia.fotografias.length === 0) {
      return new Response('No hay fotos para descargar', { status: 404 });
    }

    const bucket = getStorageBucket();
    const zip = new JSZip();

    await Promise.all(historia.fotografias.map(async (foto, i) => {
      const [buffer] = await bucket.file(pathFotoHistoria(clave, foto.id)).download();
      zip.file(nombreArchivo(i, foto.descripcion, foto.contentType), buffer);
    }));

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="mis-fotos.zip"',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return new Response('Error al armar el ZIP: ' + msg, { status: 500 });
  }
}
