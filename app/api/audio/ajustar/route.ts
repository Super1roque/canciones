import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 60;

const FFMPEG = ffmpegInstaller.path;

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, args, { maxBuffer: 200 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) reject(new Error(stderr?.slice(-400) || err.message));
      else resolve();
    });
  });
}

export async function POST(request: Request) {
  let tmpDir: string | null = null;
  try {
    const form  = await request.formData();
    const file  = form.get('file')  as File | null;
    const pitch = parseFloat((form.get('pitch')  as string) || '0');   // semitones
    const tempo = parseFloat((form.get('tempo')  as string) || '1.0'); // ratio ej. 0.85

    if (!file) return Response.json({ error: 'Falta el archivo' }, { status: 400 });
    if (Math.abs(pitch) > 6)       return Response.json({ error: 'Pitch fuera de rango (±6)' }, { status: 400 });
    if (tempo < 0.5 || tempo > 2)  return Response.json({ error: 'Tempo fuera de rango' }, { status: 400 });

    tmpDir = path.join(os.tmpdir(), `ajustar_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tmpDir);

    const ext        = (file.name.split('.').pop() || 'mp3').toLowerCase();
    const inputPath  = path.join(tmpDir, `input.${ext}`);
    const outputPath = path.join(tmpDir, 'output.mp3');

    fs.writeFileSync(inputPath, Buffer.from(await file.arrayBuffer()));

    // pitch shift: asetrate reinterpreta la velocidad de muestreo → sube/baja pitch
    // atempo compensa la duración y aplica el cambio de tempo
    const pitchFactor = Math.pow(2, pitch / 12);
    const atempoVal   = tempo / pitchFactor;

    const filters: string[] = [];
    if (Math.abs(pitch) > 0.01) {
      filters.push(`asetrate=44100*${pitchFactor.toFixed(8)}`);
    }
    // atempo solo si hay algún cambio de velocidad neto
    const atempoFinal = Math.abs(pitch) > 0.01 ? atempoVal : tempo;
    if (Math.abs(atempoFinal - 1.0) > 0.001) {
      filters.push(`atempo=${atempoFinal.toFixed(8)}`);
    }

    const args = ['-i', inputPath];
    if (filters.length) args.push('-af', filters.join(','));
    args.push('-c:a', 'libmp3lame', '-b:a', '192k', '-y', outputPath);

    await runFfmpeg(args);

    const buffer = fs.readFileSync(outputPath);
    const name   = file.name.replace(/\.[^.]+$/, '') + '_ajustado.mp3';

    return new Response(buffer, {
      headers: {
        'Content-Type':        'audio/mpeg',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Content-Length':      String(buffer.length),
      },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Error al procesar' }, { status: 500 });
  } finally {
    if (tmpDir) try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}
