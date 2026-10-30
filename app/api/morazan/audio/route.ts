import { Readable } from 'node:stream';
import { cookies } from 'next/headers';
import { getStorageBucket } from '@/lib/firebaseService';
import { checkoutMorazan, COOKIE_MORAZAN, tokenValido } from '@/lib/accesoAudiolibros';

export const runtime = 'nodejs';

const STORAGE_PATH = 'morazan/audio.mp3';
// Presentación, prólogo, introducción y capítulo 1: lo que se escucha gratis cuando el
// libro está a la venta (?parte=muestra).
const STORAGE_MUESTRA = 'morazan/muestra.mp3';

// Mismo patrón que /api/inventar-mi-futuro/audio: sirve el audio desde
// Storage con soporte de Range requests (RFC 7233), necesario para que el
// navegador pueda adelantar/atrasar sin descargar el archivo completo.
export async function GET(request: Request) {
  try {
    const muestra = new URL(request.url).searchParams.get('parte') === 'muestra';
    const enVenta = !!checkoutMorazan();
    if (!muestra && enVenta) {
      const token = (await cookies()).get(COOKIE_MORAZAN)?.value;
      if (!(await tokenValido('morazan', token))) {
        return new Response('Este audio es para quienes compraron el libro', { status: 403 });
      }
    }
    // El libro completo de un comprador no debe quedar en cachés compartidas (CDN, proxies).
    const cache = !muestra && enVenta ? 'private, max-age=31536000, immutable' : 'public, max-age=31536000, immutable';
    const file = getStorageBucket().file(muestra ? STORAGE_MUESTRA : STORAGE_PATH);
    const [metadata] = await file.getMetadata();
    const total = Number(metadata.size);
    const contentType = metadata.contentType || 'audio/mpeg';

    const range = request.headers.get('range');

    if (!range) {
      const nodeStream = file.createReadStream();
      return new Response(Readable.toWeb(nodeStream) as unknown as ReadableStream, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(total),
          'Accept-Ranges': 'bytes',
          'Cache-Control': cache,
        },
      });
    }

    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (!match) {
      return new Response('Range no válido', { status: 416 });
    }
    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? parseInt(match[2], 10) : total - 1;
    const safeEnd = Math.min(end, total - 1);

    if (start >= total || start > safeEnd) {
      return new Response('Range no satisfacible', {
        status: 416,
        headers: { 'Content-Range': `bytes */${total}` },
      });
    }

    const nodeStream = file.createReadStream({ start, end: safeEnd });
    return new Response(Readable.toWeb(nodeStream) as unknown as ReadableStream, {
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
    console.error('morazan/audio:', msg);
    return new Response('Error al reproducir el audio', { status: 500 });
  }
}
