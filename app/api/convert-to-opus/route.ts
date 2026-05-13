/**
 * POST /api/convert-to-opus
 * Acepta multipart/form-data con:
 *   - audio: cualquier archivo de audio (mp3, wav, m4a, etc.)
 *
 * Convierte a OGG/Opus (compatible con notas de voz de WhatsApp)
 * y devuelve el archivo resultante.
 */

import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const runtime = 'nodejs';

const FFMPEG_BIN = ffmpegInstaller.path;

function convertToOpus(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      FFMPEG_BIN,
      [
        '-i', inputPath,
        '-c:a', 'libopus',
        '-b:a', '32k',
        '-vbr', 'on',
        '-application', 'voip',
        '-f', 'ogg',
        '-y', outputPath,
      ],
      { maxBuffer: 50 * 1024 * 1024 },
      (err, _out, stderr) => {
        if (err) {
          console.error('[convert-to-opus] stderr:', stderr);
          reject(new Error(stderr?.slice(-600) || err.message));
        } else {
          resolve();
        }
      }
    );
  });
}

export async function POST(request: Request) {
  let tmpDir: string | null = null;

  try {
    const form      = await request.formData();
    const audioFile = form.get('audio') as File | null;

    if (!audioFile) {
      return Response.json({ error: 'Se requiere el archivo de audio.' }, { status: 400 });
    }

    tmpDir = path.join(os.tmpdir(), `opus_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tmpDir);

    const ext       = path.extname(audioFile.name).toLowerCase() || '.mp3';
    const inputPath = path.join(tmpDir, `input${ext}`);
    const outName   = audioFile.name.replace(/\.[^.]+$/, '') + '.ogg';
    const outputPath = path.join(tmpDir, 'output.ogg');

    fs.writeFileSync(inputPath, Buffer.from(await audioFile.arrayBuffer()));

    await convertToOpus(inputPath, outputPath);

    const buffer = fs.readFileSync(outputPath);

    return new Response(buffer, {
      headers: {
        'Content-Type':        'audio/ogg; codecs=opus',
        'Content-Disposition': `attachment; filename="${outName}"`,
        'Content-Length':      String(buffer.length),
      },
    });

  } catch (err) {
    console.error('[/api/convert-to-opus]', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Error al convertir.' },
      { status: 500 }
    );
  } finally {
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
    }
  }
}
