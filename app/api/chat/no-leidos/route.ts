import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { obtenerNoLeidos } from '@/lib/chatService';

// Liviano, a propósito separado de GET /api/chat/mensajes — ese marca
// todo como leído al cargarse (porque el tenant está viendo el chat), esto
// es solo para la señal del header y NUNCA debe marcar nada como leído.
// Sin cookie devuelve 0 en vez de 401 — es solo una señal visual, no hace
// falta que rompa nada si no hay sesión.
export async function GET() {
  const cookieStore = await cookies();
  const telefono = cookieStore.get('tenant_phone')?.value;
  if (!telefono) return NextResponse.json({ noLeidos: 0 });

  const noLeidos = await obtenerNoLeidos(telefono, 'tenant');
  return NextResponse.json({ noLeidos });
}
