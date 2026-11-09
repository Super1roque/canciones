import { NextResponse } from 'next/server';
import { listarConversaciones } from '@/lib/chatService';
import { soloAdmin } from '@/lib/adminServidor';

// Bandeja de /admin/mensajes — una fila por tenant con su último mensaje
// y cuántos tiene sin leer, sin escanear toda la colección de mensajes.
export async function GET(request: Request) {
  const negado = await soloAdmin(request);
  if (negado) return negado;
  const conversaciones = await listarConversaciones();
  return NextResponse.json(conversaciones);
}
