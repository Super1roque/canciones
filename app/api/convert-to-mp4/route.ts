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

async function convertToMp4(inputPath: string, outputPath: string): Promise<string> {
  // Intento 1: encoder por hardware (VideoToolbox, macOS) — muy rápido
  // Nota: VideoToolbox no garantiza Baseline profile; si WhatsApp lo rechaza
  // el fallback a libx264 siempre produce un MP4 100 % compatible.
  try {
    await runFfmpeg([
      '-i', inputPath,
      '-c:v', 'h264_videotoolbox',
      '-b:v', '1500k',           // ~50% más liviano que antes
      '-profile:v', 'baseline',
      '-vf', 'scale=-2:720',
      '-c:a', 'aac',
      '-b:a', '96k',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-y', outputPath,
    ]);
    console.log('[convert-to-mp4] ✅ Usando h264_videotoolbox (hardware)');
    return 'hardware';
  } catch (hwErr) {
    console.warn('[convert-to-mp4] VideoToolbox no disponible, usando software:', (hwErr as Error).message.slice(0, 120));
  }

  // Intento 2: libx264 ultrafast — H.264 Baseline profile, WhatsApp-compatible
  await runFfmpeg([
    '-i', inputPath,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '28',               // más liviano (22 = calidad alta, 28 = tamaño ~50% menor)
    '-profile:v', 'baseline',   // WhatsApp exige Baseline o Main profile
    '-level', '3.1',
    '-vf', 'scale=-2:720',      // máximo 720p, reduce si es mayor
    '-c:a', 'aac',
    '-b:a', '96k',              // 96k suficiente para WhatsApp (re-comprime igual)
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-y', outputPath,
  ]);
  console.log('[convert-to-mp4] ✅ Usando libx264 ultrafast baseline (software)');
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
