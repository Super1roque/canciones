import { cookies } from 'next/headers';
import { getStorageBucket } from '@/lib/firebaseService';
import { obtenerMensaje } from '@/lib/chatService';

export const runtime = 'nodejs';

// Proxy en vez de URL pública de Storage — así una foto de comprobante
// solo la puede ver el propio tenant dueño del número (se compara contra
// la cookie de sesión), igual que /api/canciones-compartidas/[id] protege
// el audio comparando reproducciones permitidas.
export async function GET(_request: Request, { params }: { params: Promise<{ mensajeId: string }> }) {
  const { mensajeId } = await params;
  const cookieStore = await cookies();
  const telefono = cookieStore.get('tenant_phone')?.value;
  if (!telefono) return new Response('No autorizado', { status: 401 });

  const mensaje = await obtenerMensaje(mensajeId);
  if (!mensaje || !mensaje.imagenPath || mensaje.telefono !== telefono) {
    return new Response('No encontrado', { status: 404 });
  }

  const [buffer] = await getStorageBucket().file(mensaje.imagenPath).download();
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': mensaje.imagenContentType || 'image/jpeg',
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
