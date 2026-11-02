import { getStorageBucket } from '@/lib/firebaseService';
import { getHistoria } from '@/lib/historias';

export const runtime = 'nodejs';

// Solo permite nombres de archivo con el patrón exacto que subimos (00.jpg, 01.jpg, ...) y libros
// que existen — nunca pasar los parámetros directo a la ruta de Storage sin validar.
const NOMBRE_VALIDO = /^[0-9]{2}\.(jpg|jpeg|png)$/;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; n: string }> }) {
  try {
    const { slug, n } = await params;
    if (!getHistoria(slug) || !NOMBRE_VALIDO.test(n)) {
      return new Response('No encontrada', { status: 404 });
    }
    const file = getStorageBucket().file(`historias/${slug}/fotos/${n}`);
    const [exists] = await file.exists();
    if (!exists) return new Response('No encontrada', { status: 404 });

    const [buffer] = await file.download();
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': n.endsWith('.png') ? 'image/png' : 'image/jpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('historias/foto:', msg);
    return new Response('Error', { status: 500 });
  }
}
