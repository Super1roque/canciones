import { getDb, getStorageBucket } from '@/lib/firebaseService';
import { vincularCancionCompartida } from '@/lib/pedidoService';
import { crearVersionLigera } from '@/lib/audioLigero';

// Guarda el audio en Storage, crea el doc de canciones_compartidas (el link /cancion/<id>) y, si viene de un
// pedido, lo vincula. Lo usan la subida manual (/api/canciones-compartidas/upload) y la generación con Gemini.
// generadaCon 'gemini': el mensaje de invitación del panel aclara que es «al estilo» y ofrece la parodia igual a la original.
export async function guardarCancionCompartida(buffer: Buffer, contentType: string, titulo: string, pedidoId?: string, generadaCon?: 'gemini'): Promise<string> {
  const id = crypto.randomUUID();
  const storagePath = `canciones-compartidas/${id}`;

  const bucket = getStorageBucket();
  await bucket.file(storagePath).save(buffer, {
    metadata: { contentType },
  });

  // La página reproduce esta copia liviana (ver lib/audioLigero.ts). Si falla, se sirve el original.
  let ligera: { storagePathLigera: string; sizeLigera: number } | null = null;
  try {
    const liviano = await crearVersionLigera(buffer);
    if (liviano.length < buffer.length * 0.85) {
      await bucket.file(`${storagePath}-ligera`).save(liviano, { metadata: { contentType: 'audio/mpeg' } });
      ligera = { storagePathLigera: `${storagePath}-ligera`, sizeLigera: liviano.length };
    }
  } catch (e) {
    console.error('guardarCancionCompartida versión ligera:', e instanceof Error ? e.message : e);
  }

  // Ya no se transcribe con Deepgram acá — se estaba tardando demasiado
  // (hasta 1-2 min por canción) y el reproductor tampoco usa la letra
  // sincronizada; solo muestra el ecualizador.
  const db = getDb();
  await db.collection('canciones_compartidas').doc(id).set({
    titulo,
    storagePath,
    contentType,
    size: buffer.length,
    ...ligera,
    ...(generadaCon ? { generadaCon } : {}),
    fecha: new Date().toISOString(),
    escuchadaCompleta: false,   // la primera escucha completa (la del dueño) es limpia; ver /escuchada
  });

  // Opcional — cuando se sube desde el modal de un pedido puntual en
  // /admin/pedidos, así el tenant dueño de ese pedido la ve en su propio
  // dashboard. Subir desde /admin/compartir-cancion (sin pedidoId) sigue
  // funcionando igual que siempre, sin vincular a nada.
  if (pedidoId) {
    await vincularCancionCompartida(pedidoId, id);
  }
  return id;
}
