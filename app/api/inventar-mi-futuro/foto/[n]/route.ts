import { getStorageBucket } from '@/lib/firebaseService';

export const runtime = 'nodejs';

// Solo permite nombres de archivo con el patrón exacto que subimos (00.jpg, 01.jpg, ...)
// — nunca pasar el parámetro directo a la ruta de Storage sin validar.
const NOMBRE_VALIDO = /^[0-9]{2}\.(jpg|jpeg|png)$/;

export async function GET(_request: Request, { params }: { params: Promise<{ n: string }> }) {
  try {
    const { n } = await params;
    if (!NOMBRE_VALIDO.test(n)) {
      return new Response('No encontrada', { status: 404 });
    }
    const bucket = getStorageBucket();
    const file = bucket.file(`inventar-mi-futuro/fotos/${n}`);
    const [exists] = await file.exists();
    if (!exists) return new Response('No encontrada', { status: 404 });

    const [buffer] = await file.download();
    const contentType = n.endsWith('.png') ? 'image/png' : 'image/jpeg';

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('inventar-mi-futuro/foto:', msg);
    return new Response('Error al cargar la foto', { status: 500 });
  }
}
