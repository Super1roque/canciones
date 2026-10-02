import { getStorageBucket } from '@/lib/firebaseService';
import { pathFotoHistoria, eliminarFotoHistoria } from '@/lib/miHistoriaService';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ clave: string; id: string }> }) {
  try {
    const { clave, id } = await params;
    const file = getStorageBucket().file(pathFotoHistoria(clave, id));
    const [existe] = await file.exists();
    if (!existe) return new Response('No encontrada', { status: 404 });
    const [buffer] = await file.download();
    const [meta] = await file.getMetadata();
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': meta.contentType || 'image/jpeg',
        'Cache-Control': 'private, max-age=31536000',
      },
    });
  } catch {
    return new Response('Error al obtener la foto', { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ clave: string; id: string }> }) {
  const { clave, id } = await params;
  await eliminarFotoHistoria(clave, id);
  return Response.json({ ok: true });
}
