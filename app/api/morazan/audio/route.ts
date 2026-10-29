import { Readable } from 'node:stream';
import { getStorageBucket } from '@/lib/firebaseService';

export const runtime = 'nodejs';

const STORAGE_PATH = 'morazan/audio.mp3';

// Mismo patrón que /api/inventar-mi-futuro/audio: sirve el audio desde
// Storage con soporte de Range requests (RFC 7233), necesario para que el
// navegador pueda adelantar/atrasar sin descargar el archivo completo.
export async function GET(request: Request) {
  try {
    const file = getStorageBucket().file(STORAGE_PATH);
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
          'Cache-Control': 'public, max-age=31536000, immutable',
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
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('morazan/audio:', msg);
    return new Response('Error al reproducir el audio', { status: 500 });
  }
}
