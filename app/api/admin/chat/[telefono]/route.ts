import { NextResponse } from 'next/server';
import { getStorageBucket } from '@/lib/firebaseService';
import { listarMensajes, enviarMensaje, marcarLeido } from '@/lib/chatService';

export const runtime = 'nodejs';

const MAX_IMAGEN_BYTES = 8 * 1024 * 1024;

export async function GET(_request: Request, { params }: { params: Promise<{ telefono: string }> }) {
  const { telefono } = await params;
  const mensajes = await listarMensajes(telefono);
  await marcarLeido(telefono, 'admin');
  return NextResponse.json(mensajes);
}

export async function POST(request: Request, { params }: { params: Promise<{ telefono: string }> }) {
  try {
    const { telefono } = await params;
    const formData = await request.formData();
    const texto = (formData.get('texto') as string | null)?.trim();
    const file = formData.get('imagen') as File | null;

    if (!texto && !file) {
      return NextResponse.json({ error: 'Escribí algo o adjuntá una foto' }, { status: 400 });
    }
    if (file && !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'El archivo debe ser una imagen' }, { status: 400 });
    }
    if (file && file.size > MAX_IMAGEN_BYTES) {
      return NextResponse.json({ error: 'La imagen supera el límite de 8 MB' }, { status: 400 });
    }

    let imagenPath: string | undefined;
    let imagenContentType: string | undefined;
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      imagenPath = `chat/${telefono}/${crypto.randomUUID()}`;
      imagenContentType = file.type;
      await getStorageBucket().file(imagenPath).save(buffer, { metadata: { contentType: file.type } });
    }

    const mensaje = await enviarMensaje(telefono, 'admin', { texto: texto || undefined, imagenPath, imagenContentType });
    return NextResponse.json(mensaje, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('admin/chat POST:', msg);
    return NextResponse.json({ error: 'Error al enviar el mensaje' }, { status: 500 });
  }
}
