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
    const form   = await request.formData();
    const file   = form.get('file')   as File | null;
    const pitch  = parseFloat((form.get('pitch')  as string) || '0');
    const tempo  = parseFloat((form.get('tempo')  as string) || '1.0');
    const noise  = Math.min(10, Math.max(0, parseFloat((form.get('noise')  as string) || '0')));
    const reverb = Math.min(10, Math.max(0, parseFloat((form.get('reverb') as string) || '0')));
    const format = (form.get('format') as string || 'mp3') === 'ogg' ? 'ogg' : 'mp3';

    if (!file) return Response.json({ error: 'Falta el archivo' }, { status: 400 });
    if (Math.abs(pitch) > 6)      return Response.json({ error: 'Pitch fuera de rango (±6)' }, { status: 400 });
    if (tempo < 0.5 || tempo > 2) return Response.json({ error: 'Tempo fuera de rango' }, { status: 400 });

    tmpDir = path.join(os.tmpdir(), `ajustar_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tmpDir);

    const ext        = (file.name.split('.').pop() || 'mp3').toLowerCase();
    const inputPath  = path.join(tmpDir, `input.${ext}`);
    const outputPath = path.join(tmpDir, `output.${format}`);
    fs.writeFileSync(inputPath, Buffer.from(await file.arrayBuffer()));

    // ── Build main filter chain ──────────────────────────────────────────
    const pitchFactor = Math.pow(2, pitch / 12);
    const atempoVal   = Math.abs(pitch) > 0.01 ? tempo / pitchFactor : tempo;
    const mainFilters: string[] = [];

    if (Math.abs(pitch) > 0.01)
      mainFilters.push(`asetrate=44100*${pitchFactor.toFixed(8)}`);
    if (Math.abs(atempoVal - 1.0) > 0.001)
      mainFilters.push(`atempo=${atempoVal.toFixed(8)}`);

    // reverb via aecho: múltiples delays cortos simulan reflexiones de sala
    if (reverb > 0) {
      const d = reverb / 10; // 0.1 – 1.0
      const decays = [d * 0.6, d * 0.45, d * 0.3, d * 0.15].map(v => v.toFixed(3)).join('|');
      mainFilters.push(`aecho=in_gain=0.8:out_gain=0.9:delays=20|40|80|160:decays=${decays}`);
    }

    const codec = format === 'ogg'
      ? ['-c:a', 'libvorbis', '-q:a', '6']
      : ['-c:a', 'libmp3lame', '-b:a', '192k'];

    const args = ['-i', inputPath];

    if (noise > 0) {
      const amplitude  = (noise * 0.005).toFixed(4);
      const audioChain = mainFilters.length ? mainFilters.join(',') : 'acopy';
      args.push(
        '-filter_complex',
        `[0:a]${audioChain}[main];` +
        `anoisesrc=color=white:amplitude=${amplitude}[wn];` +
        `[main][wn]amix=inputs=2:duration=first:dropout_transition=0[out]`,
        '-map', '[out]',
      );
    } else if (mainFilters.length) {
      args.push('-af', mainFilters.join(','));
    }

    args.push(...codec, '-y', outputPath);
    await runFfmpeg(args);

    const buffer   = fs.readFileSync(outputPath);
    const mimeType = format === 'ogg' ? 'audio/ogg' : 'audio/mpeg';
    const name     = file.name.replace(/\.[^.]+$/, '') + `_ajustado.${format}`;

    return new Response(buffer, {
      headers: {
        'Content-Type':        mimeType,
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
