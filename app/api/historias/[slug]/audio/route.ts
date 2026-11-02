import { Readable } from 'node:stream';
import { cookies } from 'next/headers';
import { getStorageBucket } from '@/lib/firebaseService';
import { tokenValido } from '@/lib/accesoAudiolibros';
import { checkoutHistoria, cookieHistoria, getHistoria } from '@/lib/historias';

export const runtime = 'nodejs';

// Mismo patrón que /api/morazan/audio, para todos los libros de /historias: sirve el audio desde
// Storage con soporte de Range requests. Si el libro está a la venta, el audio completo es solo
// para quien lo compró; la muestra (?parte=muestra) es para todos.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const historia = getHistoria((await params).slug);
    if (!historia) return new Response('No encontrado', { status: 404 });
    const muestra = new URL(request.url).searchParams.get('parte') === 'muestra' && !!historia.muestra;
    const enVenta = !!checkoutHistoria(historia);
    if (!muestra && enVenta) {
      const token = (await cookies()).get(cookieHistoria(historia.slug))?.value;
      if (!(await tokenValido(historia.slug, token))) {
        return new Response('Este audio es para quienes compraron el libro', { status: 403 });
      }
    }
    // El libro completo de un comprador no debe quedar en cachés compartidas (CDN, proxies).
    const cache = !muestra && enVenta ? 'private, max-age=31536000, immutable' : 'public, max-age=31536000, immutable';
    const file = getStorageBucket().file(`historias/${historia.slug}/${muestra ? 'muestra' : 'audio'}.mp3`);
    const [existe] = await file.exists();
    if (!existe) return new Response('No encontrado', { status: 404 });
    const [metadata] = await file.getMetadata();
    const total = Number(metadata.size);
    const contentType = metadata.contentType || 'audio/mpeg';

    const range = request.headers.get('range');
    if (!range) {
      return new Response(Readable.toWeb(file.createReadStream()) as unknown as ReadableStream, {
        status: 200,
        headers: { 'Content-Type': contentType, 'Content-Length': String(total), 'Accept-Ranges': 'bytes', 'Cache-Control': cache },
      });
    }

    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (!match) return new Response('Range no válido', { status: 416 });
    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? parseInt(match[2], 10) : total - 1;
    const safeEnd = Math.min(end, total - 1);
    if (start >= total || start > safeEnd) {
      return new Response('Range no satisfacible', { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
    }

    return new Response(Readable.toWeb(file.createReadStream({ start, end: safeEnd })) as unknown as ReadableStream, {
      status: 206,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(safeEnd - start + 1),
        'Content-Range': `bytes ${start}-${safeEnd}/${total}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': cache,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('historias/audio:', msg);
    return new Response('Error', { status: 500 });
  }
}
