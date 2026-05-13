'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import { Mp3Encoder } from '@breezystack/lamejs';

// ─── Canvas dimensions ────────────────────────────────────────────────────────
const CW = 1000;
const CH = 148;

// ─── MP3 encoder via lamejs ───────────────────────────────────────────────────
function encodeMp3(buf: AudioBuffer, s: number, e: number): Blob {
  const sr   = buf.sampleRate;
  const i0   = Math.floor(s * sr);
  const i1   = Math.min(Math.floor(e * sr), buf.length);
  const len  = i1 - i0;
  const ch   = Math.min(buf.numberOfChannels, 2);
  const toI16 = (f: Float32Array) => {
    const out = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++)
      out[i] = Math.round(Math.max(-1, Math.min(1, f[i])) * 32767);
    return out;
  };
  const left  = toI16(buf.getChannelData(0).subarray(i0, i1));
  const right = ch > 1 ? toI16(buf.getChannelData(1).subarray(i0, i1)) : null;
  const enc   = new Mp3Encoder(ch, sr, 128);
  const block = 1152;
  const raw: (Int8Array | Uint8Array)[] = [];
  for (let i = 0; i < len; i += block) {
    const l = left.subarray(i, i + block);
    const r = right ? right.subarray(i, i + block) : undefined;
    const chunk = r ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l);
    if (chunk.length) raw.push(chunk);
  }
  const tail = enc.flush();
  if (tail.length) raw.push(tail);
  // Flatten into a single plain Uint8Array<ArrayBuffer> for Blob compatibility
  const totalLen = raw.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const part of raw) { out.set(part as ArrayLike<number>, pos); pos += part.length; }
  return new Blob([out], { type: 'audio/mpeg' });
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
}

function computePeaks(buf: AudioBuffer, n: number): Float32Array {
  const out  = new Float32Array(n);
  const step = buf.length / n;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) {
      let peak = 0;
      const from = Math.floor(i * step);
      const to   = Math.min(Math.floor((i + 1) * step), buf.length);
      for (let j = from; j < to; j++) peak = Math.max(peak, Math.abs(d[j]));
      out[i] = Math.max(out[i], peak);
    }
  }
  return out;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function RecortarPage() {
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const audioCtxRef     = useRef<AudioContext | null>(null);
  const sourceRef       = useRef<AudioBufferSourceNode | null>(null);
  const animRef         = useRef<number>(0);
  const startAcTimeRef  = useRef(0);
  const startOffsetRef  = useRef(0);
  const playPosRef      = useRef(0);
  const isPlayingRef    = useRef(false);
  const peaksRef        = useRef<Float32Array>(new Float32Array(0));
  const durationRef     = useRef(0);
  const audioBufferRef  = useRef<AudioBuffer | null>(null);
  const selStartRef     = useRef(0);
  const selEndRef       = useRef(0);
  const dragAnchorRef   = useRef<number | null>(null);
  const dragModeRef     = useRef<'start' | 'end' | 'new' | null>(null);

  const [loaded,   setLoaded]   = useState(false);
  const [dragging, setDragging] = useState(false);
  const [playing,  setPlaying]  = useState(false);
  const [selStart, setSelStart] = useState(0);
  const [selEnd,   setSelEnd]   = useState(0);
  const [duration, setDuration] = useState(0);
  const [fileName, setFileName] = useState('');
  const [wavUrl,   setWavUrl]   = useState<string | null>(null);
  const [wavName,  setWavName]  = useState('');
  const [canvasCursor, setCanvasCursor] = useState<string>('crosshair');

  // ── Draw ───────────────────────────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx  = canvas.getContext('2d')!;
    const dur  = durationRef.current;
    const peaks = peaksRef.current;
    if (!dur || !peaks.length) return;

    const ss = selStartRef.current;
    const se = selEndRef.current;
    const pp = playPosRef.current;

    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, CW, CH);

    // Waveform bars
    const barW = 2;
    for (let i = 0; i < CW; i += barW) {
      const peak  = peaks[Math.round(i * peaks.length / CW)] ?? 0;
      const barH  = Math.max(2, peak * (CH - 24));
      const t     = (i / CW) * dur;
      const inSel = t >= ss && t <= se;
      ctx.fillStyle = inSel ? '#f97316' : '#252540';
      ctx.fillRect(i, (CH - 8 - barH) / 2 + 4, barW - 1, barH);
    }

    // Selection highlight overlay
    const sx1 = (ss / dur) * CW;
    const sx2 = (se / dur) * CW;
    ctx.fillStyle = 'rgba(249,115,22,0.06)';
    ctx.fillRect(sx1, 0, sx2 - sx1, CH - 18);

    // Selection boundary lines (solid)
    ctx.lineWidth   = 2;
    ctx.strokeStyle = '#f97316';
    ctx.setLineDash([]);
    [sx1, sx2].forEach(x => {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH - 18); ctx.stroke();
    });

    // Drag handles — pill grip at top
    [[sx1, 1], [sx2, -1]].forEach(([x, dir]) => {
      const cx  = x as number;
      const d   = dir as number;
      const pw  = 18;
      const ph  = 22;
      const rx  = d > 0 ? cx : cx - pw;
      // pill background
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(rx, 0, pw, ph, 5);
      else { ctx.rect(rx, 0, pw, ph); }
      ctx.fill();
      // grip lines
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth   = 1.5;
      for (let g = 0; g < 3; g++) {
        const lx = cx + d * (4 + g * 4);
        ctx.beginPath(); ctx.moveTo(lx, 6); ctx.lineTo(lx, ph - 6); ctx.stroke();
      }
    });

    // Playhead
    if (pp > 0 || isPlayingRef.current) {
      const px = (pp / dur) * CW;
      ctx.strokeStyle = 'rgba(255,255,255,0.88)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, CH - 18); ctx.stroke();
    }

    // Time ruler
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.font      = '9px monospace';
    ctx.textAlign = 'center';
    const ticks = Math.min(12, Math.max(4, Math.floor(dur)));
    for (let i = 0; i <= ticks; i++) {
      const t  = (i / ticks) * dur;
      const tx = (t / dur) * CW;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(tx - 0.5, CH - 18, 1, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      ctx.fillText(fmt(t), tx, CH - 4);
    }
  }, []);

  useEffect(() => {
    if (loaded) requestAnimationFrame(drawCanvas);
  }, [loaded, drawCanvas]);

  // ── Animation loop during playback ─────────────────────────────────────────
  const animate = useCallback(() => {
    const actx = audioCtxRef.current;
    if (!actx || !isPlayingRef.current) return;
    playPosRef.current = Math.min(
      startOffsetRef.current + (actx.currentTime - startAcTimeRef.current),
      selEndRef.current
    );
    drawCanvas();
    if (playPosRef.current < selEndRef.current) {
      animRef.current = requestAnimationFrame(animate);
    } else {
      isPlayingRef.current = false;
      setPlaying(false);
    }
  }, [drawCanvas]);

  // ── Load ───────────────────────────────────────────────────────────────────
  async function loadFile(file: File) {
    const actx = audioCtxRef.current ?? new AudioContext();
    audioCtxRef.current = actx;
    if (actx.state === 'suspended') await actx.resume();
    const buf = await actx.decodeAudioData(await file.arrayBuffer());
    audioBufferRef.current = buf;
    durationRef.current    = buf.duration;
    selStartRef.current    = 0;
    selEndRef.current      = buf.duration;
    playPosRef.current     = 0;
    peaksRef.current       = computePeaks(buf, CW);
    setDuration(buf.duration);
    setSelStart(0); setSelEnd(buf.duration);
    setFileName(file.name.replace(/\.[^.]+$/, ''));
    setWavUrl(null); setLoaded(true);
  }

  // ── Play / Stop ────────────────────────────────────────────────────────────
  async function play(from = selStartRef.current, to = selEndRef.current) {
    const buf  = audioBufferRef.current;
    const actx = audioCtxRef.current;
    if (!buf || !actx) return;
    stopAudio();
    if (actx.state === 'suspended') await actx.resume();
    const src = actx.createBufferSource();
    src.buffer = buf;
    src.connect(actx.destination);
    src.start(0, from, to - from);
    src.onended = () => { if (isPlayingRef.current) { isPlayingRef.current = false; setPlaying(false); } };
    sourceRef.current     = src;
    startAcTimeRef.current = actx.currentTime;
    startOffsetRef.current = from;
    playPosRef.current     = from;
    isPlayingRef.current   = true;
    setPlaying(true);
    animRef.current = requestAnimationFrame(animate);
  }

  function stopAudio() {
    cancelAnimationFrame(animRef.current);
    isPlayingRef.current = false;
    try { sourceRef.current?.stop(); } catch {}
    sourceRef.current = null;
    setPlaying(false);
  }

  // ── Canvas mouse (drag handles or create selection) ────────────────────────
  const HANDLE_SNAP = 14; // px within which a click grabs a handle

  function getCanvasX(e: React.MouseEvent<HTMLCanvasElement>): number {
    const rect = e.currentTarget.getBoundingClientRect();
    return (e.clientX - rect.left) * (CW / rect.width);
  }

  function getTime(e: React.MouseEvent<HTMLCanvasElement>): number {
    const x = getCanvasX(e);
    return Math.max(0, Math.min(durationRef.current, (x / CW) * durationRef.current));
  }

  function hitMode(canvasX: number): 'start' | 'end' | 'new' {
    const dur = durationRef.current;
    if (!dur) return 'new';
    const sx1 = (selStartRef.current / dur) * CW;
    const sx2 = (selEndRef.current   / dur) * CW;
    if (Math.abs(canvasX - sx1) <= HANDLE_SNAP) return 'start';
    if (Math.abs(canvasX - sx2) <= HANDLE_SNAP) return 'end';
    return 'new';
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!loaded) return;
    stopAudio();
    const cx   = getCanvasX(e);
    const t    = getTime(e);
    const mode = hitMode(cx);
    dragModeRef.current = mode;
    if (mode === 'new') {
      dragAnchorRef.current = t;
      selStartRef.current   = t;
      selEndRef.current     = t;
    }
    setCanvasCursor(mode !== 'new' ? 'ew-resize' : 'crosshair');
    drawCanvas();
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const cx = getCanvasX(e);
    const t  = getTime(e);

    if (dragModeRef.current === null) {
      // Update cursor based on proximity to handles
      const mode = hitMode(cx);
      setCanvasCursor(mode !== 'new' ? 'ew-resize' : 'crosshair');
      return;
    }

    const dur = durationRef.current;
    if (dragModeRef.current === 'start') {
      selStartRef.current = Math.max(0, Math.min(t, selEndRef.current - 0.05));
    } else if (dragModeRef.current === 'end') {
      selEndRef.current = Math.min(dur, Math.max(t, selStartRef.current + 0.05));
    } else {
      const a = dragAnchorRef.current!;
      selStartRef.current = Math.min(a, t);
      selEndRef.current   = Math.max(a, t);
    }
    drawCanvas();
  }

  function onMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    const mode = dragModeRef.current;
    if (mode === null) return;
    const t = getTime(e);

    if (mode === 'new') {
      const a = dragAnchorRef.current!;
      dragAnchorRef.current = null;
      // Single click (tiny drag) → reset to full selection
      if (Math.abs(t - a) * CW / (durationRef.current || 1) < 4) {
        selStartRef.current = 0;
        selEndRef.current   = durationRef.current;
      }
    }

    dragModeRef.current = null;
    setCanvasCursor(hitMode(getCanvasX(e)) !== 'new' ? 'ew-resize' : 'crosshair');
    setSelStart(selStartRef.current);
    setSelEnd(selEndRef.current);
    setWavUrl(null);
    drawCanvas();
  }

  // ── Precise input fields ────────────────────────────────────────────────────
  function onStartInput(v: string) {
    const n = parseFloat(v);
    if (isNaN(n)) return;
    const c = Math.max(0, Math.min(selEndRef.current - 0.01, n));
    selStartRef.current = c; setSelStart(c); setWavUrl(null); drawCanvas();
  }

  function onEndInput(v: string) {
    const n = parseFloat(v);
    if (isNaN(n)) return;
    const c = Math.min(durationRef.current, Math.max(selStartRef.current + 0.01, n));
    selEndRef.current = c; setSelEnd(c); setWavUrl(null); drawCanvas();
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  function exportMp3() {
    const buf = audioBufferRef.current;
    if (!buf) return;
    if (wavUrl) URL.revokeObjectURL(wavUrl);
    const blob = encodeMp3(buf, selStartRef.current, selEndRef.current);
    const url  = URL.createObjectURL(blob);
    const name = `${fileName}_recortado.mp3`;
    setWavUrl(url); setWavName(name);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
  }

  const selDur  = selEnd - selStart;
  const canCut  = loaded && selDur > 0.05;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🎵</span>
            <span className="logo-text">Canciones</span>
          </div>
          <a href="/" className="nav-btn">← Volver</a>
        </div>
      </header>

      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.3rem' }}>✂️ Recortar Audio</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
          Arrastra sobre la forma de onda para seleccionar el fragmento que quieres conservar
        </p>

        {/* ── Upload zone ── */}
        {!loaded && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }}
            onClick={() => document.getElementById('rc-audio')?.click()}
            style={{
              border: `2px dashed ${dragging ? '#f97316' : 'var(--border)'}`,
              borderRadius: 14, padding: '4rem 2rem', textAlign: 'center', cursor: 'pointer',
              background: dragging ? 'rgba(249,115,22,0.06)' : 'var(--surface)',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>🎵</div>
            <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.4rem' }}>
              Arrastra un archivo de audio aquí o haz clic para seleccionar
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>MP3 · WAV · M4A · OGG · FLAC</p>
            <input id="rc-audio" type="file" accept="audio/*" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) loadFile(e.target.files[0]); }} />
          </div>
        )}

        {/* ── Editor ── */}
        {loaded && (
          <>
            {/* File info bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>🎵 {fileName}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>{fmt(duration)} total</span>
              <button className="kk-mode-btn" style={{ marginLeft: 'auto', fontSize: '0.8rem' }}
                onClick={() => { stopAudio(); setLoaded(false); setWavUrl(null); }}>
                ✕ Cambiar archivo
              </button>
            </div>

            {/* Waveform canvas */}
            <div style={{
              background: '#0c0c18', borderRadius: 12, padding: '0.5rem',
              border: '1px solid var(--border)', marginBottom: '1rem',
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            }}>
              <canvas
                ref={canvasRef} width={CW} height={CH}
                style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 8, cursor: canvasCursor }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={e => { if (dragAnchorRef.current !== null) onMouseUp(e); }}
              />
            </div>

            {/* Selection time controls */}
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap' }}>
              {[
                { label: 'Inicio', val: selStart, ref: 'start' },
                { label: 'Fin',    val: selEnd,   ref: 'end'   },
              ].map(({ label, val, ref: r }) => (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', minWidth: 36 }}>{label}:</span>
                  <input
                    type="number" min={0} max={duration} step={0.01}
                    value={val.toFixed(2)}
                    onChange={e => r === 'start' ? onStartInput(e.target.value) : onEndInput(e.target.value)}
                    style={{
                      width: 84, background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '0.3rem 0.5rem', color: 'var(--text)',
                      fontSize: '0.85rem', textAlign: 'center',
                    }}
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(val)}
                  </span>
                </div>
              ))}
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f97316', marginLeft: 'auto' }}>
                ✂️ {fmt(selDur)} seleccionado
              </span>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
              <button className="kk-mode-btn" onClick={() => play(0, durationRef.current)}>
                ▶ Escuchar todo
              </button>
              <button className="kk-mode-btn active" onClick={() => play(selStartRef.current, selEndRef.current)}
                disabled={!canCut}>
                ▶ Escuchar selección
              </button>
              {playing && (
                <button className="kk-btn" style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
                  onClick={stopAudio}>⏹ Detener</button>
              )}
              <button
                className="kk-btn primary"
                onClick={exportMp3}
                disabled={!canCut}
                style={{ marginLeft: 'auto', opacity: canCut ? 1 : 0.4 }}
              >
                ✂️ Recortar y descargar .mp3
              </button>
            </div>

            {/* Success banner */}
            {wavUrl && (
              <div style={{
                padding: '0.75rem 1rem', background: 'rgba(78,201,160,0.08)',
                borderRadius: 10, border: '1px solid var(--success)',
                display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
              }}>
                <span style={{ color: 'var(--success)', fontSize: '1.1rem' }}>✓</span>
                <span style={{ fontSize: '0.88rem' }}>{wavName}</span>
                <a href={wavUrl} download={wavName}
                  style={{
                    marginLeft: 'auto', textDecoration: 'none',
                    padding: '0.3rem 0.9rem', borderRadius: 8, fontSize: '0.82rem',
                    background: 'var(--success)', color: '#000', fontWeight: 600,
                  }}>
                  ⬇ Descargar de nuevo
                </a>
              </div>
            )}
          </>
        )}

        {/* Tip */}
        <div style={{
          marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)',
          padding: '0.65rem 1rem', background: 'var(--surface)',
          borderRadius: 8, border: '1px solid var(--border)', lineHeight: 1.7,
        }}>
          💡 Arrastra sobre la forma de onda para marcar el fragmento · Clic sin arrastrar = seleccionar todo ·
          Ajusta los tiempos con precisión en los campos · El archivo se descarga como <strong>.mp3</strong>
        </div>
      </div>
    </div>
  );
}
