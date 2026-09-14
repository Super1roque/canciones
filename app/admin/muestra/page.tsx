'use client';
import { useState, useRef } from 'react';

// ── Configuración de la marca de agua ──────────────────────────────────────
const MARK_START    = 15;   // primera marca en el segundo 15
const MARK_INTERVAL = 22;   // cada 22 segundos
const MARK_DURATION = 3.5;  // duración de cada marca (segundos)
const DIM_LEVEL     = 0.10; // volumen del original durante la marca (10%)

// Descarga y decodifica el audio de voz "esta es una muestra" desde la API
async function fetchWatermark(targetSampleRate: number): Promise<Float32Array> {
  const res = await fetch('/api/tts');
  if (!res.ok) throw new Error('No se pudo generar la voz de marca de agua');
  const arrayBuf = await res.arrayBuffer();
  const ctx      = new OfflineAudioContext(1, Math.round(MARK_DURATION * targetSampleRate), targetSampleRate);
  const decoded  = await ctx.decodeAudioData(arrayBuf);

  // Remezclar a mono y resampling al sampleRate del archivo original
  const offCtx   = new OfflineAudioContext(1, Math.round(MARK_DURATION * targetSampleRate), targetSampleRate);
  const src      = offCtx.createBufferSource();
  src.buffer     = decoded;
  src.connect(offCtx.destination);
  src.start(0);
  const rendered = await offCtx.startRendering();
  return rendered.getChannelData(0);
}

// Aplica la marca de agua a un canal de audio
function processChannel(input: Float32Array, sampleRate: number, wm: Float32Array): Float32Array {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const t       = i / sampleRate;
    const elapsed = t - MARK_START;
    if (elapsed >= 0) {
      const posInCycle = elapsed % MARK_INTERVAL;
      if (posInCycle < MARK_DURATION) {
        const wmIdx = Math.round(posInCycle * sampleRate);
        out[i] = input[i] * DIM_LEVEL + (wmIdx < wm.length ? wm[wmIdx] : 0);
        continue;
      }
    }
    out[i] = input[i];
  }
  return out;
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function MuestraPage() {
  const [file,       setFile]       = useState<File | null>(null);
  const [phase,      setPhase]      = useState<'idle'|'processing'|'done'|'error'>('idle');
  const [progress,   setProgress]   = useState(0);
  const [outputUrl,  setOutputUrl]  = useState('');
  const [outputName, setOutputName] = useState('');
  const [duration,   setDuration]   = useState(0);
  const [error,      setError]      = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setFile(f);
    setPhase('idle');
    setOutputUrl('');
    setError('');
    // Leer duración
    const audio = new Audio(URL.createObjectURL(f));
    audio.onloadedmetadata = () => setDuration(Math.round(audio.duration));
  }

  // Cuántas marcas tendrá el archivo
  function countMarks(dur: number) {
    if (dur <= MARK_START) return 0;
    return Math.floor((dur - MARK_START) / MARK_INTERVAL) + 1;
  }

  async function process() {
    if (!file) return;
    setPhase('processing'); setProgress(0); setError('');

    try {
      // 1. Decodificar audio
      setProgress(5);
      const arrayBuf = await file.arrayBuffer();
      const ctx      = new AudioContext();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      await ctx.close();
      setProgress(20);

      const sampleRate = audioBuf.sampleRate;
      const channels   = audioBuf.numberOfChannels;
      const wm         = await fetchWatermark(sampleRate);

      // 2. Procesar cada canal
      const processed: Float32Array[] = [];
      for (let c = 0; c < channels; c++) {
        processed.push(processChannel(audioBuf.getChannelData(c), sampleRate, wm));
        setProgress(20 + Math.round((c + 1) / channels * 30));
      }
      setProgress(55);

      // 3. Convertir a Int16 para lamejs
      const toInt16 = (buf: Float32Array) => {
        const out = new Int16Array(buf.length);
        for (let i = 0; i < buf.length; i++) {
          const s = Math.max(-1, Math.min(1, buf[i]));
          out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        return out;
      };

      const left  = toInt16(processed[0]);
      const right = channels > 1 ? toInt16(processed[1]) : toInt16(processed[0]);
      setProgress(65);

      // 4. Codificar a MP3 con lamejs
      const { Mp3Encoder } = await import('@breezystack/lamejs');
      const encoder  = new Mp3Encoder(2, sampleRate, 128);
      const chunkSz  = 1152;
      const mp3Chunks: Uint8Array[] = [];
      const total    = left.length;

      for (let i = 0; i < total; i += chunkSz) {
        const l = left.subarray(i, i + chunkSz);
        const r = right.subarray(i, i + chunkSz);
        const buf = encoder.encodeBuffer(l, r);
        if (buf.length > 0) mp3Chunks.push(new Uint8Array(buf));
        if (i % (chunkSz * 200) === 0) {
          setProgress(65 + Math.round((i / total) * 30));
          await new Promise(r => setTimeout(r, 0)); // yield al UI
        }
      }
      const tail = encoder.flush();
      if (tail.length > 0) mp3Chunks.push(new Uint8Array(tail));
      setProgress(97);

      // 5. Crear descarga
      const blob = new Blob(mp3Chunks, { type: 'audio/mpeg' });
      const url  = URL.createObjectURL(blob);
      const name = file.name.replace(/\.mp3$/i, '') + '_muestra.mp3';
      setOutputUrl(url);
      setOutputName(name);
      setProgress(100);
      setPhase('done');

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar');
      setPhase('error');
    }
  }

  const marks = countMarks(duration);

  const box: React.CSSProperties = {
    background: 'var(--surface, #1a1a1a)',
    border: '1px solid var(--border, #333)',
    borderRadius: 16,
    padding: '1.5rem',
    marginBottom: '1.5rem',
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'sans-serif', color: '#eee' }}>
      <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: '#888', textDecoration: 'none', marginBottom: '1.5rem' }}>
        ← Volver al menú
      </a>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.4rem' }}>
        🎵 Generador de Muestra con Marca de Agua
      </h1>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '2rem' }}>
        Agrega una marca de agua de sonido cada {MARK_INTERVAL} segundos (iniciando en el segundo {MARK_START}) para entregar una muestra del producto original.
      </p>

      {/* Upload */}
      <div style={box}>
        <input ref={fileRef} type="file" accept="audio/mp3,audio/mpeg,.mp3,audio/mp4,audio/x-m4a,.m4a" style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />

        <div onClick={() => fileRef.current?.click()}
          style={{
            border: '2px dashed #444', borderRadius: 10, padding: '1.5rem', textAlign: 'center',
            cursor: 'pointer', marginBottom: '1rem',
            background: file ? 'rgba(249,115,22,0.05)' : 'transparent',
          }}>
          {file
            ? <span style={{ color: '#f97316' }}>🎵 {file.name} {duration > 0 ? `(${fmtTime(duration)})` : ''}</span>
            : <span style={{ color: '#666' }}>Haz clic o arrastra un archivo MP3</span>}
        </div>

        {file && duration > 0 && (
          <div style={{ fontSize: '0.82rem', color: '#888', marginBottom: '1rem', lineHeight: 1.6 }}>
            📍 Se insertarán <strong style={{ color: '#f97316' }}>{marks} marca{marks !== 1 ? 's' : ''} de agua</strong> en:&nbsp;
            {Array.from({ length: marks }, (_, i) => fmtTime(MARK_START + i * MARK_INTERVAL)).join(' · ')}
          </div>
        )}

        <button
          onClick={process}
          disabled={!file || phase === 'processing'}
          style={{
            width: '100%', padding: '0.75rem', borderRadius: 10,
            background: !file || phase === 'processing' ? '#333' : '#f97316',
            color: '#fff', fontWeight: 700, fontSize: '0.95rem', border: 'none', cursor: 'pointer',
          }}>
          {phase === 'processing' ? `⏳ Procesando... ${progress}%` : '🎬 Generar muestra'}
        </button>

        {phase === 'processing' && (
          <div style={{ marginTop: '0.75rem', background: '#222', borderRadius: 6, overflow: 'hidden', height: 8 }}>
            <div style={{ background: '#f97316', height: '100%', width: `${progress}%`, transition: 'width 0.3s' }} />
          </div>
        )}
      </div>

      {/* Resultado */}
      {phase === 'done' && outputUrl && (
        <div style={{ ...box, border: '1px solid rgba(249,115,22,0.4)' }}>
          <p style={{ fontWeight: 700, marginBottom: '1rem', color: '#f97316' }}>✅ Muestra generada</p>
          <audio controls src={outputUrl} style={{ width: '100%', marginBottom: '1rem' }} />
          <a href={outputUrl} download={outputName}
            style={{
              display: 'block', textAlign: 'center', padding: '0.75rem',
              background: '#f97316', color: '#fff', borderRadius: 10,
              fontWeight: 700, textDecoration: 'none',
            }}>
            ⬇ Descargar {outputName}
          </a>
        </div>
      )}

      {phase === 'error' && (
        <div style={{ ...box, border: '1px solid #e53e3e', color: '#e53e3e' }}>
          ❌ {error}
        </div>
      )}

      {/* Info */}
      <div style={{ ...box, background: 'transparent', border: '1px solid #2a2a2a' }}>
        <p style={{ fontSize: '0.8rem', color: '#555', lineHeight: 1.7, margin: 0 }}>
          <strong style={{ color: '#666' }}>Cómo funciona:</strong><br />
          El audio original suena normalmente. Cada {MARK_INTERVAL} segundos (desde el segundo {MARK_START}) el volumen baja al {Math.round(DIM_LEVEL * 100)}% durante {MARK_DURATION} segundos y una voz dice <em>"esta es una muestra"</em>. El resultado es un MP3 descargable listo para compartir como muestra.
        </p>
      </div>
    </div>
  );
}
