import { getDb, getStorageBucket } from '@/lib/firebaseService';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const runtime = 'nodejs';

const FFMPEG = ffmpegInstaller.path;

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, args, { maxBuffer: 200 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) reject(new Error(stderr?.slice(-400) || err.message));
      else resolve();
    });
  });
}

function runFfprobe(args: string[]): Promise<string> {
  const ffprobePath = FFMPEG.replace(/ffmpeg$/, 'ffprobe');
  return new Promise((resolve, reject) => {
    execFile(ffprobePath, args, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr?.slice(-400) || err.message));
      else resolve(stdout);
    });
  });
}

async function truncateToHalf(buffer: Buffer, contentType: string, ext: string): Promise<Buffer> {
  const tmpDir = path.join(os.tmpdir(), `trunc_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(tmpDir);
  try {
    const inputPath  = path.join(tmpDir, `input.${ext}`);
    const outputPath = path.join(tmpDir, `output.${ext}`);
    fs.writeFileSync(inputPath, buffer);

    // Get duration via ffprobe
    const out = await runFfprobe([
      '-v', 'quiet', '-print_format', 'json', '-show_format', inputPath,
    ]);
    const info     = JSON.parse(out);
    const duration = parseFloat(info?.format?.duration || '0');
    const half     = (duration / 2).toFixed(3);

    const codec = contentType.includes('ogg')
      ? ['-c:a', 'libvorbis', '-q:a', '6']
      : ['-c:a', 'libmp3lame', '-b:a', '192k'];

    await runFfmpeg(['-i', inputPath, '-t', half, ...codec, '-y', outputPath]);
    return fs.readFileSync(outputPath);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

function parseDevice(ua: string): string {
  if (/iPhone/.test(ua))        return '📱 iPhone';
  if (/iPad/.test(ua))          return '📱 iPad';
  if (/Android/.test(ua))       return '📱 Android';
  if (/Windows/.test(ua))       return '💻 Windows';
  if (/Macintosh/.test(ua))     return '💻 Mac';
  if (/Linux/.test(ua))         return '💻 Linux';
  return '🌐 Desconocido';
}

function parseBrowser(ua: string): string {
  if (/SamsungBrowser/.test(ua)) return 'Samsung Browser';
  if (/OPR|Opera/.test(ua))      return 'Opera';
  if (/Edg/.test(ua))            return 'Edge';
  if (/Chrome/.test(ua))         return 'Chrome';
  if (/Safari/.test(ua))         return 'Safari';
  if (/Firefox/.test(ua))        return 'Firefox';
  return 'Desconocido';
}

async function getLocation(ip: string): Promise<string> {
  try {
    const res  = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,status`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json().catch(() => ({ status: 'fail' }));
    if (data.status === 'success') return `🌍 ${data.city}, ${data.country}`;
  } catch {}
  return '🌍 Ubicación desconocida';
}

async function notifyTelegram(text: string) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  }).catch(() => {});
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db      = getDb();
    const docRef  = db.collection('audio_shares').doc(id);

    let storagePath = '';
    let contentType = 'audio/mpeg';
    let fileName    = '';
    let playNumber  = 0;

    try {
      await db.runTransaction(async (tx) => {
        const doc = await tx.get(docRef);
        if (!doc.exists)       throw new Error('NOT_FOUND');
        const data = doc.data()!;
        if (data.playsLeft <= 0) throw new Error('ALREADY_PLAYED');
        playNumber  = 3 - data.playsLeft; // playsLeft=2 → play#1, playsLeft=1 → play#2
        tx.update(docRef, { playsLeft: data.playsLeft - 1, lastPlayedAt: new Date().toISOString() });
        storagePath = data.storagePath;
        contentType = data.contentType || 'audio/mpeg';
        fileName    = data.fileName    || 'audio';
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'NOT_FOUND')      return new Response('Link no válido',         { status: 404 });
      if (msg === 'ALREADY_PLAYED') return new Response('Audio ya fue escuchado', { status: 403 });
      throw e;
    }

    // Gather info for Telegram notification (non-blocking)
    const ua      = req.headers.get('user-agent') || '';
    const ip      = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'desconocida';
    const device  = parseDevice(ua);
    const browser = parseBrowser(ua);
    const now     = new Date().toLocaleString('es-HN', { timeZone: 'America/Tegucigalpa', hour12: true });

    // Extract phone number from filename (format: xxxx-xxxx)
    const phoneMatch = fileName.match(/(\d{4}-\d{4})/);
    const waLink     = phoneMatch
      ? `\n📲 <a href="https://wa.me/504${phoneMatch[1].replace('-', '')}">Escribir por WhatsApp</a>`
      : '';

    getLocation(ip).then(location => {
      notifyTelegram(
        `🎵 <b>Audio escuchado — Play #${playNumber} de 2</b>\n\n` +
        `📁 ${fileName}\n` +
        `${device} / ${browser}\n` +
        `${location}\n` +
        `🌐 IP: ${ip}\n` +
        `🕐 ${now}` +
        waLink
      );
    });

    const bucket = getStorageBucket();
    const fileRef = bucket.file(storagePath);
    const [rawBuffer] = await fileRef.download();

    const snap = await docRef.get();
    if ((snap.data()?.playsLeft ?? 0) <= 0) {
      await fileRef.delete().catch(() => {});
    }

    // For the 2nd play, serve only the first 50% of the audio
    let finalBuffer: Buffer = rawBuffer;
    if (playNumber === 2) {
      const ext = contentType.includes('ogg') ? 'ogg' : 'mp3';
      finalBuffer = await truncateToHalf(rawBuffer, contentType, ext);
    }

    return new Response(new Uint8Array(finalBuffer), {
      headers: {
        'Content-Type':   contentType,
        'Content-Length': finalBuffer.length.toString(),
        'Cache-Control':  'no-store',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('audio/[id]:', msg);
    return new Response('Error al reproducir el audio', { status: 500 });
  }
}
