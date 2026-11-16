import { getDb, getStorageBucket } from '@/lib/firebaseService';
import { soloAdmin } from '@/lib/adminServidor';

export const runtime = 'nodejs';

// Sirve al panel la foto de un comprobante de pago (?id=<canción>&i=<índice>). Solo el admin.
export async function GET(request: Request) {
  const negado = await soloAdmin(request);
  if (negado) return negado;
  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? '';
  const i = Number(url.searchParams.get('i') ?? 0);
  const doc = await getDb().collection('canciones_compartidas').doc(id).get();
  const comp = (doc.get('comprobantes') as { path: string; contentType: string }[] | undefined)?.[i];
  if (!comp) return new Response('No encontrado', { status: 404 });
  const [buffer] = await getStorageBucket().file(comp.path).download();
  return new Response(new Uint8Array(buffer), { headers: { 'Content-Type': comp.contentType || 'image/jpeg', 'Cache-Control': 'no-store' } });
}
