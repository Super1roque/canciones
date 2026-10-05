import { NextResponse } from 'next/server';
import { transcribirNarracion } from '@/lib/deepgramService';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Transcripción con timestamps para Video de Relato — separada de
// /api/transcribe (pensada para canciones: prioriza whisper-large y filtra
// palabras comunes para descartar créditos de subtítulos, algo que
// destruiría un relato hablado normal).
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

  const result = await transcribirNarracion(audioBuffer, contentType);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json(result);
}
