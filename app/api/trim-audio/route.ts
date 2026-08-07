import { NextResponse } from 'next/server';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 30;

const FFMPEG_BIN = ffmpegInstaller.path;

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG_BIN, args, { maxBuffer: 100 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) reject(new Error(stderr?.slice(-1000) || err.message));
      else resolve();
    });
  });
}

// Recorta un audio a sus primeros N segundos, re-codificando a mp3
// para garantizar un corte limpio sin importar el formato de entrada.
export async function POST(request: Request) {
  let tmpDir: string | null = null;
  try {
    const form    = await request.formData();
    const audio   = form.get('audio') as File | null;
    const seconds = Number(form.get('seconds') ?? '65') || 65;

    if (!audio) return NextResponse.json({ error: 'Se requiere el archivo de audio.' }, { status: 400 });

    tmpDir = path.join(os.tmpdir(), `trim_${Date.now()}`);
    fs.mkdirSync(tmpDir);
    const inPath  = path.join(tmpDir, `in${path.extname(audio.name).toLowerCase() || '.mp3'}`);
    const outPath = path.join(tmpDir, 'out.mp3');
    fs.writeFileSync(inPath, Buffer.from(await audio.arrayBuffer()));

    await runFfmpeg(['-y', '-i', inPath, '-t', String(seconds), '-c:a', 'libmp3lame', '-b:a', '128k', outPath]);

    const buf = fs.readFileSync(outPath);
    return new NextResponse(new Uint8Array(buf), { headers: { 'Content-Type': 'audio/mpeg' } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error recortando audio:', msg);
    return NextResponse.json({ error: 'Error al recortar audio: ' + msg }, { status: 500 });
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
