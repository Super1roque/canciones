import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import { readFile, writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FFMPEG_BIN  = ffmpegInstaller.path;
const RAW_ASSET   = join(process.cwd(), 'public', 'watermark.raw');

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) =>
    execFile(FFMPEG_BIN, args, { maxBuffer: 50 * 1024 * 1024 }, (err, _o, stderr) =>
      err ? reject(new Error((stderr || '').slice(-500) || err.message)) : resolve()
    )
  );
}

export async function GET() {
  const tmpWav = join(tmpdir(), `tts_${Date.now()}.wav`);

  try {
    if (!existsSync(RAW_ASSET)) {
      return new Response('Archivo de marca de agua no encontrado', { status: 500 });
    }

    // Convertir PCM f32le mono 44100Hz → WAV estéreo
    const rawBuf = await readFile(RAW_ASSET);
    const rawTmp = join(tmpdir(), `wm_${Date.now()}.raw`);
    await writeFile(rawTmp, rawBuf);
    await runFfmpeg(['-y', '-f', 'f32le', '-ar', '44100', '-ac', '1', '-i', rawTmp,
                     '-ar', '44100', '-ac', '2', tmpWav]);
    await unlink(rawTmp).catch(() => {});

    const audioData = await readFile(tmpWav);
    return new Response(audioData, {
      headers: {
        'Content-Type':  'audio/wav',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    return new Response('Error generando TTS: ' + (e as Error).message, { status: 500 });
  } finally {
    await unlink(tmpWav).catch(() => {});
  }
}
