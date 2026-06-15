/**
 * POST /api/convert-to-mp4
 * Acepta multipart/form-data con:
 *   - video: archivo .webm o .mp4
 *
 * Re-encoda a MP4 (H.264 Baseline + AAC) compatible con WhatsApp.
 * WhatsApp exige: H.264 Baseline/Main profile, yuv420p, AAC, faststart.
 * Intenta primero con el encoder por hardware de macOS (h264_videotoolbox),
 * 5-10x más rápido. Si no está disponible cae a libx264 ultrafast.
 */

import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 120;

const FFMPEG_BIN = ffmpegInstaller.path;

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG_BIN, args, { maxBuffer: 500 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) reject(new Error(stderr?.slice(-600) || err.message));
      else resolve();
    });
  });
}

// Detecta si el archivo tiene pista de audio usando la salida de stderr de ffmpeg
function detectAudio(inputPath: string): Promise<boolean> {
  return new Promise(resolve => {
    execFile(FFMPEG_BIN, ['-i', inputPath, '-hide_banner'], {}, (_err, _out, stderr) => {
      resolve(/Stream.*Audio/i.test(stderr));
    });
  });
}

async function convertToMp4(inputPath: string, outputPath: string): Promise<string> {
  const hasAudio = await detectAudio(inputPath);
  console.log(`[convert-to-mp4] Audio detectado: ${hasAudio}`);

  // Si no hay audio en el WebM, usamos una fuente silenciosa como fallback
  // para garantizar que el MP4 siempre tenga pista de audio.
  const audioInputArgs  = hasAudio ? [] : ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo'];
  const audioMapArgs    = hasAudio ? ['-c:a', 'aac', '-b:a', '128k']
                                   : ['-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '128k', '-shortest'];

  // Limita a 1920px de altura máx y asegura dimensiones pares
  const scaleFilter = "scale='trunc(iw/2)*2':'trunc(min(ih,1920)/2)*2'";

  // libx264 — respeta maxrate estrictamente, tamaño controlado
  await runFfmpeg([
    '-i', inputPath,
    ...audioInputArgs,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-maxrate', '3000k',
    '-bufsize', '6000k',
    '-profile:v', 'high',
    '-level', '4.0',
    '-vf', scaleFilter,
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    ...audioMapArgs,
    '-y', outputPath,
  ]);
  console.log('[convert-to-mp4] ✅ libx264 fast high (software)');
  return 'software';
}

export async function POST(request: Request) {
  let tmpDir: string | null = null;

  try {
    const form      = await request.formData();
    const videoFile = form.get('video') as File | null;

    if (!videoFile) {
      return Response.json({ error: 'Se requiere el archivo de video.' }, { status: 400 });
    }

    tmpDir = path.join(os.tmpdir(), `mp4_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tmpDir);

    // Detectar extensión real del input para que ffmpeg lo identifique bien
    const ext = videoFile.name.endsWith('.mp4') ? 'mp4' : 'webm';
    const inputPath  = path.join(tmpDir, `input.${ext}`);
    const outputPath = path.join(tmpDir, 'output.mp4');

    fs.writeFileSync(inputPath, Buffer.from(await videoFile.arrayBuffer()));

    await convertToMp4(inputPath, outputPath);

    const buffer = fs.readFileSync(outputPath);

    return new Response(buffer, {
      headers: {
        'Content-Type':        'video/mp4',
        'Content-Disposition': 'attachment; filename="karaoke.mp4"',
        'Content-Length':      String(buffer.length),
      },
    });

  } catch (err) {
    console.error('[/api/convert-to-mp4]', err);
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
