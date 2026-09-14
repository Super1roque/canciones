'use client';
import { useState, useRef, useEffect } from 'react';

type NoteEvent = {
  startTimeSeconds: number;
  durationSeconds:  number;
  pitchMidi:        number;
  amplitude:        number;
};

type Phase = 'idle' | 'loading_model' | 'analyzing' | 'ready' | 'playing' | 'rendering' | 'error';

const INSTRUMENTS = [
  { id: 'acoustic_grand_piano',  label: '🎹 Piano',    wave: 'triangle' as OscillatorType, attack: 0.005, decay: 0.4,  sustainRatio: 0.35, release: 0.6 },
  { id: 'violin',                label: '🎻 Violín',   wave: 'sawtooth' as OscillatorType, attack: 0.08,  decay: 0.08, sustainRatio: 0.85, release: 0.3 },
  { id: 'acoustic_guitar_nylon', label: '🎸 Guitarra', wave: 'triangle' as OscillatorType, attack: 0.005, decay: 0.5,  sustainRatio: 0.25, release: 0.4 },
  { id: 'flute',                 label: '🪈 Flauta',   wave: 'sine'     as OscillatorType, attack: 0.06,  decay: 0.05, sustainRatio: 0.90, release: 0.2 },
  { id: 'trumpet',               label: '🎺 Trompeta',    wave: 'sawtooth' as OscillatorType, attack: 0.02,  decay: 0.1,  sustainRatio: 0.80, release: 0.1 },
  { id: 'cello',                 label: '🎻 Violonchelo', wave: 'sawtooth' as OscillatorType, attack: 0.12,  decay: 0.1,  sustainRatio: 0.88, release: 0.5 },
] as const;

type InstrumentId = typeof INSTRUMENTS[number]['id'];

function fmtSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function scheduleNotes(
  ctx: BaseAudioContext,
  notes: NoteEvent[],
  inst: typeof INSTRUMENTS[number],
  startOffset = 0,
) {
  notes.forEach(note => {
    const freq = midiToFreq(note.pitchMidi);
    const t0   = startOffset + note.startTimeSeconds;
    const t1   = t0 + Math.max(0.05, note.durationSeconds);
    const amp  = Math.max(0.4, Math.min(1, note.amplitude * 2));

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = inst.wave;
    osc.frequency.setValueAtTime(freq, t0);
    osc.connect(gain);
    gain.connect(ctx.destination);

    const sus = amp * inst.sustainRatio;
    const rel = inst.release;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(amp, t0 + inst.attack);
    gain.gain.linearRampToValueAtTime(sus, t0 + inst.attack + inst.decay);
    gain.gain.setValueAtTime(sus, Math.max(t0 + inst.attack + inst.decay, t1 - rel));
    gain.gain.linearRampToValueAtTime(0, t1 + rel);

    osc.start(t0);
    osc.stop(t1 + rel + 0.05);
  });
}

function writeStr(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function audioBufferToWav(buf: AudioBuffer): Blob {
  const ch = 2, sr = buf.sampleRate, len = buf.length;
  const dataSize = len * ch * 2;
  const ab = new ArrayBuffer(44 + dataSize);
  const v  = new DataView(ab);
  writeStr(v, 0, 'RIFF'); v.setUint32(4,  36 + dataSize, true);
  writeStr(v, 8, 'WAVE'); writeStr(v, 12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, ch, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  writeStr(v, 36, 'data'); v.setUint32(40, dataSize, true);
  const L = buf.getChannelData(0);
  const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  let off = 44;
  for (let i = 0; i < len; i++) {
    const l = Math.max(-1, Math.min(1, L[i]));
    const r = Math.max(-1, Math.min(1, R[i]));
    v.setInt16(off, l < 0 ? l * 0x8000 : l * 0x7FFF, true); off += 2;
    v.setInt16(off, r < 0 ? r * 0x8000 : r * 0x7FFF, true); off += 2;
  }
  return new Blob([ab], { type: 'audio/wav' });
}

export default function InstrumentoPage() {
  const [file,       setFile]       = useState<File | null>(null);
  const [phase,      setPhase]      = useState<Phase>('idle');
  const [progress,   setProgress]   = useState(0);
  const [notes,      setNotes]      = useState<NoteEvent[]>([]);
  const [error,      setError]      = useState('');
  const [dragging,   setDragging]   = useState(false);
  const [instrument, setInstrument] = useState<InstrumentId>('acoustic_grand_piano');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const stopTimeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workerRef   = useRef<Worker | null>(null);

  useEffect(() => () => { workerRef.current?.terminate(); }, []);

  function handleFile(f: File) {
    if (!f.type.startsWith('audio/')) { setError('Solo archivos de audio'); return; }
    if (f.size > 10 * 1024 * 1024)   { setError('El archivo supera 10 MB'); return; }
    setError(''); setFile(f); setNotes([]); setPhase('idle');
  }

  async function analyze() {
    if (!file) return;
    setPhase('loading_model'); setProgress(0); setError('');

    try {
      // Decode audio on main thread (native async — no freeze)
      const decodeCtx = new AudioContext({ sampleRate: 22050 });
      const audioBuf  = await decodeCtx.decodeAudioData(await file.arrayBuffer());
      await decodeCtx.close();

      // Mix to mono yielding every 50k samples so the UI no se congela
      let mono: Float32Array;
      if (audioBuf.numberOfChannels === 1) {
        mono = audioBuf.getChannelData(0).slice();
      } else {
        const ch0 = audioBuf.getChannelData(0), ch1 = audioBuf.getChannelData(1);
        mono = new Float32Array(ch0.length);
        const CHUNK = 50_000;
        for (let i = 0; i < ch0.length; i += CHUNK) {
          const end = Math.min(ch0.length, i + CHUNK);
          for (let j = i; j < end; j++) mono[j] = (ch0[j] + ch1[j]) / 2;
          await new Promise(r => setTimeout(r, 0));
        }
      }

      setPhase('analyzing');

      // Terminar worker previo si existe
      workerRef.current?.terminate();

      // Todo el trabajo pesado de TF.js ocurre en el worker — hilo principal libre
      const worker = new Worker(new URL('./worker.ts', import.meta.url));
      workerRef.current = worker;
      const modelUrl = `${window.location.origin}/basic-pitch-model/model.json`;

      worker.onmessage = (ev: MessageEvent) => {
        const msg = ev.data;
        if (msg.type === 'progress') {
          setProgress(msg.value);
        } else if (msg.type === 'done') {
          setNotes(msg.notes);
          setPhase('ready');
          worker.terminate(); workerRef.current = null;
        } else if (msg.type === 'error') {
          setError(msg.message);
          setPhase('error');
          worker.terminate(); workerRef.current = null;
        }
      };
      worker.onerror = (ev: ErrorEvent) => {
        setError(ev.message || 'Error en el análisis');
        setPhase('error');
        worker.terminate(); workerRef.current = null;
      };

      // Transferir el buffer al worker (copia cero — sin duplicar memoria)
      worker.postMessage({ mono, modelUrl }, [mono.buffer]);

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al analizar');
      setPhase('error');
    }
  }

  function getInst() {
    return INSTRUMENTS.find(i => i.id === instrument)!;
  }

  function play() {
    if (!notes.length) return;
    stopPlayback();

    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const inst = getInst();
    scheduleNotes(ctx, notes, inst, ctx.currentTime + 0.05);

    setPhase('playing');
    const totalDur = Math.max(...notes.map(n => n.startTimeSeconds + n.durationSeconds));
    stopTimeRef.current = setTimeout(() => setPhase('ready'), (totalDur + inst.release + 1) * 1000);
  }

  function stopPlayback() {
    if (stopTimeRef.current) clearTimeout(stopTimeRef.current);
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setPhase('ready');
  }

  async function renderAndDownload() {
    if (!notes.length) return;
    stopPlayback();
    setPhase('rendering'); setProgress(0); setError('');

    try {
      const inst     = getInst();
      const totalDur = Math.max(...notes.map(n => n.startTimeSeconds + n.durationSeconds));
      const SR       = 44100;
      const frames   = Math.ceil((totalDur + inst.release + 1) * SR);
      const offCtx   = new OfflineAudioContext(2, frames, SR);

      scheduleNotes(offCtx, notes, inst, 0);

      // Register checkpoints so we can update the progress bar
      const STEPS = 20;
      for (let i = 1; i < STEPS; i++) {
        const t = (frames * i / STEPS) / SR;
        offCtx.suspend(t).then(() => {
          setProgress(Math.round((i / STEPS) * 100));
          offCtx.resume();
        });
      }

      const rendered = await offCtx.startRendering();
      setProgress(78);

      // Encode to MP3 in the browser using lamejs (yields to avoid UI freeze)
      const { Mp3Encoder } = await import('@breezystack/lamejs');
      const sr      = rendered.sampleRate;
      const chL     = rendered.getChannelData(0);
      const chR     = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : chL;
      const encoder = new Mp3Encoder(1, sr, 64); // mono 64 kbps — small, good for melody
      const mono    = new Int16Array(chL.length);
      for (let i = 0; i < chL.length; i++) {
        const s = Math.max(-1, Math.min(1, (chL[i] + chR[i]) / 2));
        mono[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      const BLOCK = 1152;
      const mp3Parts: Uint8Array[] = [];
      for (let i = 0; i < mono.length; i += BLOCK) {
        const chunk   = mono.subarray(i, i + BLOCK);
        const encoded = encoder.encodeBuffer(chunk);
        if (encoded.length > 0) mp3Parts.push(encoded);
        if (i % (BLOCK * 50) === 0) {
          setProgress(78 + Math.round((i / mono.length) * 8));
          await new Promise(r => setTimeout(r, 0));
        }
      }
      const tail = encoder.flush();
      if (tail.length > 0) mp3Parts.push(tail);
      setProgress(87);

      // Send MP3 to server → FFmpeg converts to OGG
      const mp3Blob = new Blob(mp3Parts as BlobPart[], { type: 'audio/mpeg' });
      const fd = new FormData();
      fd.append('file', mp3Blob, 'audio.mp3');
      fd.append('pitch', '0'); fd.append('tempo', '1'); fd.append('format', 'ogg');

      const res = await fetch('/api/audio/ajustar', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Error al convertir a OGG');
      setProgress(100);

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${file?.name.replace(/\.[^.]+$/, '') ?? 'melodia'}_${instrument}.ogg`;
      a.click();
      URL.revokeObjectURL(url);
      setPhase('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al renderizar');
      setPhase('ready');
    }
  }

  const busy     = phase === 'loading_model' || phase === 'analyzing' || phase === 'rendering';
  const instLabel = INSTRUMENTS.find(i => i.id === instrument)?.label.split(' ')[1] ?? '';

  const statusMsg =
    phase === 'loading_model' ? 'Cargando modelo IA (puede tardar 1-2 min en local)...' :
    phase === 'analyzing'     ? `Analizando melodía... ${progress}%` :
    phase === 'rendering'     ? (progress < 78 ? `⏳ Generando audio... ${progress}%` : progress < 87 ? `⏳ Comprimiendo... ${progress}%` : `⏳ Convirtiendo a OGG... ${progress}%`) :
    phase === 'ready'         ? `✓ ${notes.length} notas detectadas` :
    phase === 'playing'       ? '▶ Reproduciendo...' : '';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <header className="header">
        <div className="header-inner">
          <div className="logo"><span className="logo-icon">🎵</span><span className="logo-text">Canciones</span></div>
          <a href="/" className="nav-btn">← Volver</a>
        </div>
      </header>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.3rem' }}>🎹 Voz a Instrumento</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.75rem' }}>
          Detecta la melodía de un audio a capella y la reproduce con un instrumento
        </p>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => document.getElementById('inst-file')?.click()}
          style={{
            border: `2px dashed ${dragging ? '#f97316' : file ? 'var(--success)' : 'var(--border)'}`,
            borderRadius: 14, padding: '2.5rem 2rem', textAlign: 'center', cursor: 'pointer',
            background: dragging ? 'rgba(249,115,22,0.06)' : file ? 'rgba(78,201,160,0.04)' : 'var(--surface)',
            transition: 'all 0.2s', marginBottom: '1.5rem',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{file ? '🎵' : '📁'}</div>
          {file ? (
            <>
              <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.2rem' }}>{file.name}</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{fmtSize(file.size)}</p>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.3rem' }}>Arrastra un audio a capella o haz clic</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>MP3 · WAV · M4A — máximo 10 MB</p>
            </>
          )}
          <input id="inst-file" type="file" accept="audio/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
        </div>

        {/* Instrument selector */}
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Instrumento de salida</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {INSTRUMENTS.map(inst => (
              <button key={inst.id} onClick={() => setInstrument(inst.id)}
                style={{
                  padding: '0.4rem 0.85rem', borderRadius: 8, fontSize: '0.82rem', cursor: 'pointer',
                  border: instrument === inst.id ? '1px solid #f97316' : '1px solid var(--border)',
                  background: instrument === inst.id ? 'rgba(249,115,22,0.15)' : 'var(--surface)',
                  color: instrument === inst.id ? '#f97316' : 'var(--text-muted)',
                }}>
                {inst.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>⚠️ {error}</p>}

        {statusMsg && (
          <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem',
            color: phase === 'ready' ? 'var(--success)' : 'var(--text-muted)' }}>
            {statusMsg}
          </p>
        )}
        {(phase === 'analyzing' || phase === 'rendering') && (
          <div style={{ background: 'var(--border)', borderRadius: 4, height: 6, marginBottom: '1rem', overflow: 'hidden' }}>
            <div style={{ background: '#f97316', height: '100%', width: `${progress}%`, transition: 'width 0.2s', borderRadius: 4 }} />
          </div>
        )}

        {/* Analyze */}
        {phase !== 'ready' && phase !== 'playing' && (
          <button className="kk-btn primary" onClick={analyze} disabled={!file || busy}
            style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginBottom: '0.75rem',
              opacity: (!file || busy) ? 0.5 : 1 }}>
            {busy ? '⏳ Procesando...' : '🎵 Analizar melodía'}
          </button>
        )}

        {/* Play / Stop / Download */}
        {(phase === 'ready' || phase === 'playing') && (
          <>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <button className="kk-btn primary" onClick={play} disabled={phase === 'playing'}
                style={{ flex: 1, padding: '0.85rem', fontSize: '1rem', opacity: phase === 'playing' ? 0.5 : 1 }}>
                ▶ Reproducir con {instLabel}
              </button>
              {phase === 'playing' && (
                <button onClick={stopPlayback}
                  style={{ padding: '0.85rem 1.25rem', fontSize: '1rem', cursor: 'pointer',
                    border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', borderRadius: 10 }}>
                  ⏹ Parar
                </button>
              )}
            </div>

            {phase === 'ready' && (
              <>
                <button className="kk-btn primary" onClick={renderAndDownload}
                  style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginBottom: '0.75rem',
                    background: 'rgba(249,115,22,0.12)', border: '1px solid #f97316', color: '#f97316' }}>
                  ⬇ Descargar como OGG
                </button>
                <button onClick={() => { setPhase('idle'); setNotes([]); setFile(null); }}
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.82rem', cursor: 'pointer',
                    border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', borderRadius: 8 }}>
                  Cargar otro archivo
                </button>
              </>
            )}
          </>
        )}

        <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.65rem 1rem',
          background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', lineHeight: 1.8 }}>
          💡 Funciona mejor con <strong>voz sola</strong> sin música de fondo · Todo ocurre en tu dispositivo, sin subir archivos
        </div>
      </div>
    </div>
  );
}
