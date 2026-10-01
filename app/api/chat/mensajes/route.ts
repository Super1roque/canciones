import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStorageBucket } from '@/lib/firebaseService';
import { listarMensajes, enviarMensaje, marcarLeido } from '@/lib/chatService';
import { avisarNuevoMensajeAdmin } from '@/lib/pushService';

export const runtime = 'nodejs';

// Fotos de celular (comprobantes, capturas de pantalla) — no hace falta
// más que esto, a diferencia del audio de canciones-compartidas/upload.
const MAX_IMAGEN_BYTES = 8 * 1024 * 1024;

export async function GET() {
  const cookieStore = await cookies();
  const telefono = cookieStore.get('tenant_phone')?.value;
  if (!telefono) {
    return NextResponse.json({ error: 'Necesitás registrarte con tu número de teléfono' }, { status: 401 });
  }

  const mensajes = await listarMensajes(telefono);
  // Efecto lateral intencional: el dashboard pide esto en su polling, así
  // que cargar la bandeja ya cuenta como "leído" del lado del tenant.
  await marcarLeido(telefono, 'tenant');
  return NextResponse.json(mensajes);
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const telefono = cookieStore.get('tenant_phone')?.value;
    if (!telefono) {
      return NextResponse.json({ error: 'Necesitás registrarte con tu número de teléfono' }, { status: 401 });
    }

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

    const mensaje = await enviarMensaje(telefono, 'tenant', { texto: texto || undefined, imagenPath, imagenContentType });
    void avisarNuevoMensajeAdmin(telefono, texto || undefined);
    return NextResponse.json(mensaje, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('chat/mensajes POST:', msg);
    return NextResponse.json({ error: 'Error al enviar el mensaje' }, { status: 500 });
  }
}
