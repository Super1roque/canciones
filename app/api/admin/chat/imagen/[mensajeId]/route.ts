import { getStorageBucket } from '@/lib/firebaseService';
import { obtenerMensaje } from '@/lib/chatService';
import { soloAdmin } from '@/lib/adminServidor';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ mensajeId: string }> }) {
  const negado = await soloAdmin(request);
  if (negado) return negado;
  const { mensajeId } = await params;
  const mensaje = await obtenerMensaje(mensajeId);
  if (!mensaje || !mensaje.imagenPath) return new Response('No encontrado', { status: 404 });

  const [buffer] = await getStorageBucket().file(mensaje.imagenPath).download();
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': mensaje.imagenContentType || 'image/jpeg',
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
