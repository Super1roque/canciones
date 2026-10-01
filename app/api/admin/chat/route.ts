import { NextResponse } from 'next/server';
import { listarConversaciones } from '@/lib/chatService';

// Bandeja de /admin/mensajes — una fila por tenant con su último mensaje
// y cuántos tiene sin leer, sin escanear toda la colección de mensajes.
export async function GET() {
  const conversaciones = await listarConversaciones();
  return NextResponse.json(conversaciones);
}
