import { exec } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile, unlink } from 'fs/promises';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const execAsync = promisify(exec);

export async function GET() {
  const tmpAiff = join(tmpdir(), `tts_${Date.now()}.aiff`);
  const tmpWav  = join(tmpdir(), `tts_${Date.now()}.wav`);

  try {
    // Generar voz con say de macOS (voz Paulina en español mexicano)
    await execAsync(`say -v Paulina -r 150 "esta es una muestra" -o "${tmpAiff}"`);

    // Convertir AIFF a WAV estéreo 44100 Hz con ffmpeg
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
    await execAsync(`"${ffmpegPath}" -y -i "${tmpAiff}" -ar 44100 -ac 2 "${tmpWav}"`);

    const audioData = await readFile(tmpWav);
    return new Response(audioData, {
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new Response('Error generando TTS', { status: 500 });
  } finally {
    await unlink(tmpAiff).catch(() => {});
    await unlink(tmpWav).catch(() => {});
  }
}
