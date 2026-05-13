import { getDb, getStorageBucket } from '@/lib/firebaseService';

export const runtime = 'nodejs';

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
    const data = await res.json();
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

    try {
      await db.runTransaction(async (tx) => {
        const doc = await tx.get(docRef);
        if (!doc.exists)  throw new Error('NOT_FOUND');
        const data = doc.data()!;
        if (data.played)  throw new Error('ALREADY_PLAYED');
        tx.update(docRef, { played: true, playedAt: new Date().toISOString() });
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

    getLocation(ip).then(location => {
      notifyTelegram(
        `🎵 <b>Audio escuchado</b>\n\n` +
        `📁 ${fileName}\n` +
        `${device} / ${browser}\n` +
        `${location}\n` +
        `🌐 IP: ${ip}\n` +
        `🕐 ${now}`
      );
    });

    const bucket = getStorageBucket();
    const [buffer] = await bucket.file(storagePath).download();
    await bucket.file(storagePath).delete().catch(() => {});

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type':   contentType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control':  'no-store',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('audio/[id]:', msg);
    return new Response('Error al reproducir el audio', { status: 500 });
  }
}
