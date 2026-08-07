import { NextResponse } from 'next/server';
import { transcribirPalabras } from '@/lib/deepgramService';

export const maxDuration = 120; // hasta 2 min para canciones largas

export async function POST(request: Request) {
  let audioBuffer: ArrayBuffer;
  let contentType = 'audio/mpeg';

  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('audio') as File | null;
    if (!file) return NextResponse.json({ error: 'Falta el archivo de audio' }, { status: 400 });
    contentType = file.type || 'audio/mpeg';
    audioBuffer = await file.arrayBuffer();
  } else {
    audioBuffer = await request.arrayBuffer();
    contentType = ct || 'audio/mpeg';
  }

  const result = await transcribirPalabras(audioBuffer, contentType);

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json(result);
}
