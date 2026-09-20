import { NextResponse } from 'next/server';
import { getDb, getStorageBucket } from '@/lib/firebaseService';
import { transcribirPalabras } from '@/lib/deepgramService';
import { vincularCancionCompartida } from '@/lib/pedidoService';

export const runtime = 'nodejs';
export const maxDuration = 120; // hasta 2 min — canción completa, igual que /api/transcribe

// Colección separada de `audio_shares` (esa es el teaser de pago de
// /escuchar — 2 reproducciones y se borra). Acá el objetivo es viralizar,
// no cobrar: se puede escuchar indefinidamente.
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const titulo = (formData.get('titulo') as string | null)?.trim();
    const pedidoId = (formData.get('pedidoId') as string | null)?.trim();

    if (!file) return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    if (!file.type.startsWith('audio/')) return NextResponse.json({ error: 'El archivo debe ser audio' }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'El archivo supera el límite de 20 MB' }, { status: 400 });
    if (!titulo) return NextResponse.json({ error: 'Falta el título de la canción' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const id = crypto.randomUUID();
    const storagePath = `canciones-compartidas/${id}`;

    const bucket = getStorageBucket();
    await bucket.file(storagePath).save(buffer, {
      metadata: { contentType: file.type || 'audio/mpeg' },
    });

    // Letra sincronizada — se espera acá mismo, antes de responder. Se
    // probó primero sin esperar (fire-and-forget, como el aviso de Telegram
    // de /api/audio/[id]), pero en producción Render corta esa tarea de
    // fondo apenas se manda la respuesta — nunca llegaba a guardar las
    // cues. Igual que /api/transcribe, que sí funciona de forma síncrona.
    // Si falla, el doc se guarda igual pero sin `cues` — el reproductor ya
    // sabe mostrar el ecualizador en ese caso.
    const transcripcion = await transcribirPalabras(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      file.type || 'audio/mpeg'
    );
    if (!('cues' in transcripcion)) {
      console.error('canciones-compartidas transcripción:', transcripcion.error);
    }

    const db = getDb();
    await db.collection('canciones_compartidas').doc(id).set({
      titulo,
      storagePath,
      contentType: file.type || 'audio/mpeg',
      size: buffer.length,
      fecha: new Date().toISOString(),
      ...('cues' in transcripcion ? { cues: transcripcion.cues } : {}),
    });

    // Opcional — cuando se sube desde el modal de un pedido puntual en
    // /admin/pedidos, así el tenant dueño de ese pedido la ve en su propio
    // dashboard. Subir desde /admin/compartir-cancion (sin pedidoId) sigue
    // funcionando igual que siempre, sin vincular a nada.
    if (pedidoId) {
      await vincularCancionCompartida(pedidoId, id);
    }

    return NextResponse.json({ id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('canciones-compartidas/upload:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
