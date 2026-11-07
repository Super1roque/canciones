import { Readable } from 'node:stream';
import { cookies } from 'next/headers';
import { getStorageBucket } from '@/lib/firebaseService';
import { COOKIE_MIEMBRO, miembroActivo } from '@/lib/miembrosApoya';
import { capituloGratis, getRadionovela } from '@/lib/radionovelas';

export const runtime = 'nodejs';

// Audio de un capítulo de radionovela, desde Storage (radionovelas/<slug>/capNN.mp3), con Range requests como
// el de /historias. El capítulo 1 es para todos (en las privadas, todos los capítulos); los demás, solo para
// miembros activos de /apoya.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string; cap: string }> }) {
  try {
    const { slug, cap } = await params;
    const novela = getRadionovela(slug);
    const n = /^[0-9]{1,2}$/.test(cap) ? parseInt(cap, 10) : 0;
    if (!novela || !novela.capitulos.some((c) => c.n === n)) return new Response('No encontrado', { status: 404 });
    const gratis = capituloGratis(n, novela);
    if (!gratis && !(await miembroActivo((await cookies()).get(COOKIE_MIEMBRO)?.value))) {
      return new Response('Este capítulo es para miembros', { status: 403 });
    }
    // Lo de miembros no debe quedar en cachés compartidas (CDN, proxies).
    const cache = gratis ? 'public, max-age=31536000, immutable' : 'private, max-age=31536000, immutable';
    const file = getStorageBucket().file(`radionovelas/${novela.slug}/cap${String(n).padStart(2, '0')}.mp3`);
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
    console.error('radionovelas/audio:', msg);
    return new Response('Error', { status: 500 });
  }
}
