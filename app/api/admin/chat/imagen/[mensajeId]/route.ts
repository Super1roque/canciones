import { getStorageBucket } from '@/lib/firebaseService';
import { obtenerMensaje } from '@/lib/chatService';

export const runtime = 'nodejs';

// Sin chequeo de sesión acá, igual que el resto de /api/admin/* — el
// panel admin entero confía en el guard del lado cliente (AdminGuard +
// esSuperAdmin), no hay verificación server-side en ninguna otra ruta.
export async function GET(_request: Request, { params }: { params: Promise<{ mensajeId: string }> }) {
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
