import { getStorageBucket } from '@/lib/firebaseService';
import { pathAudioRespuesta, eliminarAudioRespuesta } from '@/lib/miHistoriaService';

export const runtime = 'nodejs';

// Guarda/sirve la grabación de voz REAL de una respuesta puntual (no la
// transcripción, el audio tal cual se grabó) — para que la página de
// Memoria (/historia/[clave]/memoria) pueda reproducir la voz real de
// quien contó la historia. claveResp es la misma clave interna de la
// respuesta ("e2_p3") que usa el resto de la app.

export async function POST(request: Request, { params }: { params: Promise<{ clave: string; claveResp: string }> }) {
  try {
    const { clave, claveResp } = await params;
    const form = await request.formData();
    const file = form.get('audio') as File | null;
    if (!file) return Response.json({ error: 'Falta el audio' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    await getStorageBucket().file(pathAudioRespuesta(clave, claveResp)).save(buffer, {
      metadata: { contentType: file.type || 'audio/webm' },
    });

    return Response.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ clave: string; claveResp: string }> }) {
  try {
    const { clave, claveResp } = await params;
    const file = getStorageBucket().file(pathAudioRespuesta(clave, claveResp));
    const [existe] = await file.exists();
    if (!existe) return new Response('No encontrada', { status: 404 });
    const [buffer] = await file.download();
    const [meta] = await file.getMetadata();
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': meta.contentType || 'audio/webm',
        'Cache-Control': 'private, max-age=31536000',
      },
    });
  } catch {
    return new Response('Error al obtener el audio', { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ clave: string; claveResp: string }> }) {
  const { clave, claveResp } = await params;
  await eliminarAudioRespuesta(clave, claveResp);
  return Response.json({ ok: true });
}
