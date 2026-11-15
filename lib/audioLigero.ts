import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Copia liviana de una canción para escucharla en la página: mp3 a 96 kbps (unos 2.8 MB en vez de
// 7-9 MB). Con datos lentos la canción completa tardaba tanto en bajar que la gente creía que no
// funcionaba y volvía a tocar play (Armando, 15 nov 2026). La descarga pagada sigue siendo el original.
export const KBPS_LIGERA = 96;

export async function crearVersionLigera(original: Buffer): Promise<Buffer> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ligera_'));
  try {
    const entrada = path.join(dir, 'in'), salida = path.join(dir, 'out.mp3');
    fs.writeFileSync(entrada, original);
    await new Promise<void>((resolve, reject) => {
      execFile(ffmpegInstaller.path, ['-y', '-i', entrada, '-map', '0:a', '-c:a', 'libmp3lame', '-b:a', `${KBPS_LIGERA}k`, salida],
        { maxBuffer: 100 * 1024 * 1024 }, (err, _out, stderr) => err ? reject(new Error(stderr?.slice(-500) || err.message)) : resolve());
    });
    return fs.readFileSync(salida);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
