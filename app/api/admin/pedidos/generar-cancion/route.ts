import { NextResponse } from 'next/server';
import { soloAdmin } from '@/lib/adminServidor';
import { obtenerPedido } from '@/lib/pedidoService';
import { generarCancionLyria } from '@/lib/lyriaService';
import { guardarCancionCompartida } from '@/lib/guardarCancionCompartida';

export const runtime = 'nodejs';
export const maxDuration = 300;   // Lyria tarda ~40 s a 1 min por canción

// Botón «Generar con Gemini» del modal de un pedido: hace la canción con el estilo y la parodia del pedido
// y la deja publicada igual que si se hubiera subido el mp3 a mano (link /cancion/<id> vinculado al pedido).
export async function POST(request: Request) {
  const noAutorizado = await soloAdmin(request);
  if (noAutorizado) return noAutorizado;
  try {
    const { pedidoId, titulo } = await request.json();
    if (!pedidoId) return NextResponse.json({ error: 'Falta el id del pedido' }, { status: 400 });
    if (!titulo?.trim()) return NextResponse.json({ error: 'Falta el título de la canción' }, { status: 400 });

    const p = await obtenerPedido(pedidoId);
    if (!p) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    if (p.cancionCompartidaId) return NextResponse.json({ error: 'Este pedido ya tiene canción: quitá el enlace primero' }, { status: 409 });
    if (!p.parodia?.trim()) return NextResponse.json({ error: 'El pedido no tiene letra' }, { status: 400 });

    const estilo = [p.estilo, p.descripcionEstilo].filter(Boolean).join(' — ');
    const { audio, mimeType } = await generarCancionLyria(estilo, p.parodia);
    const id = await guardarCancionCompartida(audio, mimeType, titulo.trim(), pedidoId, 'gemini');
    return NextResponse.json({ id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('generar-cancion:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
