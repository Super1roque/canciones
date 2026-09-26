'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import { Mp3Encoder } from '@breezystack/lamejs';

type Estado = 'idle' | 'requesting' | 'recording' | 'processing' | 'done' | 'error';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Los primeros segundos de captura son casi siempre un gap en silencio
// (el tiempo que tarda el navegador en empezar a entregar audio real tras
// el selector de "qué compartir") — se recorta del MP3 final, no del
// WEBM (ese queda como el original crudo, sin tocar).
const RECORTE_INICIO_SEG = 4;

// ─── MP3 encoder via lamejs — mismo patrón que /recortar, pero sobre el
// buffer completo (sin zonas/recortes) ────────────────────────────────────────
async function encodeMp3(buf: AudioBuffer, onProgress?: (p: number) => void, offsetSeconds = 0): Promise<Blob> {
  const sr = buf.sampleRate;
  const ch = Math.min(buf.numberOfChannels, 2);
  // Si la grabación es más corta que el recorte, no se recorta nada — mejor
  // entregar el audio completo que un mp3 vacío.
  const offsetSamples = buf.length > sr * offsetSeconds ? Math.round(offsetSeconds * sr) : 0;

  // Normalización de volumen: busca el pico más alto de la grabación (ya
  // recortada) y calcula cuánto hay que multiplicar la señal para que ese
  // pico llegue casi al máximo, sin pasarse (evita distorsión). Tope de 8x
  // para no convertir en ruido audible una grabación que quedó casi en
  // silencio.
  let peak = 0;
  for (let c = 0; c < ch; c++) {
    const data = buf.getChannelData(c).subarray(offsetSamples);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }
  const TARGET_PEAK = 0.95;
  const MAX_GAIN = 8;
  const gain = peak > 0 ? Math.min(TARGET_PEAK / peak, MAX_GAIN) : 1;

  const toI16 = (f: Float32Array) => {
    const out = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) out[i] = Math.round(Math.max(-1, Math.min(1, f[i] * gain)) * 32767);
    return out;
  };
  const left = toI16(buf.getChannelData(0).subarray(offsetSamples));
  const right = ch > 1 ? toI16(buf.getChannelData(1).subarray(offsetSamples)) : null;
  const enc = new Mp3Encoder(ch, sr, 256);
  const block = 1152;
  const raw: (Int8Array | Uint8Array)[] = [];
  const totalBlocks = Math.ceil(left.length / block);
  for (let idx = 0, i = 0; i < left.length; i += block, idx++) {
    const l = left.subarray(i, i + block);
    const r = right ? right.subarray(i, i + block) : undefined;
    const chunk = r ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l);
    if (chunk.length) raw.push(chunk);
    if (idx % 50 === 0) {
      onProgress?.(Math.round((idx / totalBlocks) * 100));
      await new Promise(r => setTimeout(r, 0));
    }
  }
  const tail = enc.flush();
  if (tail.length) raw.push(tail);
  onProgress?.(100);
  const totalLen = raw.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const part of raw) { out.set(part as ArrayLike<number>, pos); pos += part.length; }
  return new Blob([out], { type: 'audio/mpeg' });
}

export default function GrabarPage() {
  const [estado, setEstado] = useState<Estado>('idle');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [mp3Url, setMp3Url] = useState('');
  const [webmUrl, setWebmUrl] = useState('');

  const displayStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    displayStreamRef.current?.getTracks().forEach(t => t.stop());
    if (mp3Url) URL.revokeObjectURL(mp3Url);
    if (webmUrl) URL.revokeObjectURL(webmUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detener = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    displayStreamRef.current?.getTracks().forEach(t => t.stop());
    displayStreamRef.current = null;
    setEstado('processing');
  }, []);

  async function procesar() {
    const webmBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
    if (webmBlob.size === 0) {
      setError('La grabación quedó vacía — probá de nuevo y confirmá que compartiste audio.');
      setEstado('idle');
      return;
    }
    setWebmUrl(URL.createObjectURL(webmBlob));
    try {
      const arrayBuf = await webmBlob.arrayBuffer();
      const ctx = new AudioContext();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      setProgress(0);
      const mp3Blob = await encodeMp3(audioBuf, setProgress, RECORTE_INICIO_SEG);
      setMp3Url(URL.createObjectURL(mp3Blob));
      ctx.close();
    } catch {
      // Si falla la conversión a mp3, queda el webm como respaldo — igual se puede descargar y escuchar.
    }
    setEstado('done');
  }

  async function iniciar() {
    setError('');
    setEstado('requesting');
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        // Sin esto, Chrome le aplica al audio el mismo procesamiento que usa
        // para llamadas (cancelación de eco, supresión de ruido, control
        // automático de volumen) — pensado para voz, aplana la música.
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 },
      });
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        displayStream.getTracks().forEach(t => t.stop());
        setError('No se compartió audio. Al elegir la pestaña o pantalla, marcá la casilla "Compartir audio" antes de confirmar.');
        setEstado('idle');
        return;
      }
      displayStreamRef.current = displayStream;
      const audioOnly = new MediaStream(audioTracks);
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      // Bitrate explícito — sin esto el navegador suele elegir uno bajo por
      // defecto para grabaciones de audio, perdiendo calidad de entrada.
      const rec = new MediaRecorder(audioOnly, { mimeType, audioBitsPerSecond: 256000 });
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = procesar;
      rec.start();
      recorderRef.current = rec;

      // Si el usuario detiene el compartir desde el propio navegador (en vez
      // de nuestro botón), hay que cortar la grabación igual.
      displayStream.getVideoTracks()[0]?.addEventListener('ended', detener);
      audioTracks[0].addEventListener('ended', detener);

      startRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 250);
      setEstado('recording');
    } catch (err) {
      setEstado('idle');
      if ((err as Error)?.name === 'NotAllowedError') {
        setError('Cancelaste el permiso de compartir pantalla o pestaña.');
      } else if (!navigator.mediaDevices?.getDisplayMedia) {
        setError('Tu navegador no soporta esta función. Probá con Chrome o Edge en computadora.');
      } else {
        setError('No se pudo iniciar la captura de audio.');
      }
    }
  }

  function reiniciar() {
    if (mp3Url) URL.revokeObjectURL(mp3Url);
    if (webmUrl) URL.revokeObjectURL(webmUrl);
    setMp3Url(''); setWebmUrl(''); setError(''); setProgress(0); setElapsed(0);
    setEstado('idle');
  }

  const fecha = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <header className="header">
        <div className="header-inner">
          <div className="logo"><span className="logo-icon">🎵</span><span className="logo-text">Canciones</span></div>
          <a href="/admin" className="nav-btn">← Volver</a>
        </div>
      </header>

      <div style={{ maxWidth: 580, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.3rem' }}>🎙️ Grabar Audio</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.75rem', lineHeight: 1.6 }}>
          Captura el sonido que esté reproduciendo tu computadora — una pestaña, una app, o toda la pantalla —
          y te lo entrega como archivo descargable. Grabá solo audio del que tengas derecho a guardar (tus propias canciones, llamadas, etc.).
        </p>

        {estado === 'idle' && (
          <>
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
              padding: '1.25rem', marginBottom: '1.25rem', fontSize: '0.82rem', lineHeight: 1.7, color: 'var(--text-muted)',
            }}>
              💡 Al hacer clic, el navegador te va a pedir elegir qué compartir (pestaña, ventana o pantalla).
              Elegí la opción y activá la casilla <strong>&quot;Compartir audio&quot;</strong> antes de confirmar — si no la marcás, no se graba sonido.
              <br /><br />
              ⚠️ Funciona en Chrome o Edge de computadora. Safari y navegadores de celular no soportan esta función.
            </div>

            {error && (
              <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: '1rem' }}>⚠️ {error}</p>
            )}

            <button className="kk-btn primary" onClick={iniciar} style={{ width: '100%', fontSize: '1rem', padding: '0.85rem' }}>
              🔴 Elegir qué grabar
            </button>
          </>
        )}

        {estado === 'requesting' && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
            ⏳ Esperando el permiso del navegador…
          </p>
        )}

        {estado === 'recording' && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
            padding: '2rem', textAlign: 'center',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              color: 'var(--error)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem',
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%', background: 'var(--error)',
                animation: 'pulse 1s infinite',
              }} />
              Grabando
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'monospace', marginBottom: '1.5rem' }}>
              {fmt(elapsed)}
            </p>
            <button className="kk-btn primary" onClick={detener} style={{ width: '100%', fontSize: '1rem', padding: '0.85rem' }}>
              ⏹️ Detener grabación
            </button>
          </div>
        )}

        {estado === 'processing' && (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: '0.75rem' }}>⏳ Procesando grabación{progress > 0 ? `… ${progress}%` : '…'}</p>
            <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', transition: 'width 0.15s' }} />
            </div>
          </div>
        )}

        {estado === 'done' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '2rem' }}>
            <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '0.75rem' }}>✅</div>
            <p style={{ fontWeight: 700, textAlign: 'center', fontSize: '1.05rem', marginBottom: '1.25rem' }}>
              ¡Grabación lista! ({fmt(elapsed)})
            </p>

            <audio controls src={mp3Url || webmUrl} style={{ width: '100%', marginBottom: '1.25rem' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {mp3Url && (
                <a
                  className="kk-btn primary"
                  href={mp3Url}
                  download={`grabacion-${fecha}.mp3`}
                  style={{ textAlign: 'center', textDecoration: 'none' }}
                >
                  ⬇️ Descargar MP3
                </a>
              )}
              {webmUrl && (
                <a
                  className="kk-mode-btn"
                  href={webmUrl}
                  download={`grabacion-${fecha}.webm`}
                  style={{ textAlign: 'center', textDecoration: 'none' }}
                >
                  ⬇️ Descargar WEBM {mp3Url ? '(original, sin comprimir)' : ''}
                </a>
              )}
            </div>

            <button className="kk-mode-btn" onClick={reiniciar} style={{ marginTop: '1.25rem', width: '100%' }}>
              🔁 Grabar otra vez
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
