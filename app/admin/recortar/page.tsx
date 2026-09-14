'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import { Mp3Encoder } from '@breezystack/lamejs';

// ─── Canvas dimensions ────────────────────────────────────────────────────────
const CW = 1000;
const CH = 148;

type Zone = { start: number; end: number };

const GAP_SEC = 1; // silence inserted between fragments in the exported mp3

// ─── Merge overlapping/adjacent zones, sorted by start time ──────────────────
function mergeZones(zones: Zone[]): Zone[] {
  const sorted = [...zones].sort((a, b) => a.start - b.start);
  const out: Zone[] = [];
  for (const z of sorted) {
    const last = out[out.length - 1];
    if (last && z.start <= last.end + 0.001) last.end = Math.max(last.end, z.end);
    else out.push({ ...z });
  }
  return out;
}

// ─── MP3 encoder via lamejs (async — yields every 50 blocks to keep UI responsive) ──
async function encodeMp3Async(
  buf: AudioBuffer, ranges: Zone[],
  onProgress?: (p: number) => void
): Promise<Blob> {
  const sr   = buf.sampleRate;
  const ch   = Math.min(buf.numberOfChannels, 2);
  const toI16 = (f: Float32Array) => {
    const out = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++)
      out[i] = Math.round(Math.max(-1, Math.min(1, f[i])) * 32767);
    return out;
  };

  const chData0 = buf.getChannelData(0);
  const chData1 = ch > 1 ? buf.getChannelData(1) : null;
  const segs = ranges.map(r => {
    const i0 = Math.floor(r.start * sr);
    const i1 = Math.min(Math.floor(r.end * sr), buf.length);
    return { i0, len: Math.max(0, i1 - i0) };
  });
  const gapLen  = Math.round(GAP_SEC * sr);
  const gapsLen = gapLen * Math.max(0, segs.length - 1);
  const totalLen = segs.reduce((s, seg) => s + seg.len, 0) + gapsLen;

  // Float32Array is zero-initialized, so the gaps are silence by default
  const leftAll  = new Float32Array(totalLen);
  const rightAll = chData1 ? new Float32Array(totalLen) : null;
  let pos = 0;
  segs.forEach(({ i0, len }, idx) => {
    leftAll.set(chData0.subarray(i0, i0 + len), pos);
    if (rightAll && chData1) rightAll.set(chData1.subarray(i0, i0 + len), pos);
    pos += len;
    if (idx < segs.length - 1) pos += gapLen;
  });

  const left  = toI16(leftAll);
  const right = rightAll ? toI16(rightAll) : null;
  const enc   = new Mp3Encoder(ch, sr, 128);
  const block = 1152;
  const raw: (Int8Array | Uint8Array)[] = [];
  const totalBlocks = Math.ceil(totalLen / block);

  for (let idx = 0, i = 0; i < totalLen; i += block, idx++) {
    const l = left.subarray(i, i + block);
    const r = right ? right.subarray(i, i + block) : undefined;
    const chunk = r ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l);
    if (chunk.length) raw.push(chunk);
    // Yield every 50 blocks so the browser stays responsive
    if (idx % 50 === 0) {
      onProgress?.(Math.round((idx / totalBlocks) * 95));
      await new Promise(r => setTimeout(r, 0));
    }
  }
  const tail = enc.flush();
  if (tail.length) raw.push(tail);
  onProgress?.(100);
  const totalOutLen = raw.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(totalOutLen);
  let opos = 0;
  for (const part of raw) { out.set(part as ArrayLike<number>, opos); opos += part.length; }
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
  const playEndRef      = useRef(0);
  const playPosRef      = useRef(0);
  const isPlayingRef    = useRef(false);
  const peaksRef        = useRef<Float32Array>(new Float32Array(0));
  const durationRef     = useRef(0);
  const audioBufferRef  = useRef<AudioBuffer | null>(null);

  const zonesRef        = useRef<Zone[]>([]);
  const activeIdxRef    = useRef<number | null>(null);
  const draftRef        = useRef<Zone | null>(null);
  const dragAnchorRef   = useRef<number | null>(null);
  const dragIdxRef      = useRef<number | null>(null);
  const dragModeRef     = useRef<'start' | 'end' | 'new' | null>(null);

  const [loaded,   setLoaded]   = useState(false);
  const [dragging, setDragging] = useState(false);
  const [playing,  setPlaying]  = useState(false);
  const [zones,     setZones]     = useState<Zone[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [fileName, setFileName] = useState('');
  const [wavUrl,     setWavUrl]     = useState<string | null>(null);
  const [wavName,    setWavName]    = useState('');
  const [encoding,   setEncoding]   = useState(false);
  const [encProgress, setEncProgress] = useState(0);
  const [canvasCursor, setCanvasCursor] = useState<string>('crosshair');

  function selectZone(i: number | null) {
    activeIdxRef.current = i;
    setActiveIdx(i);
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx  = canvas.getContext('2d')!;
    const dur  = durationRef.current;
    const peaks = peaksRef.current;
    if (!dur || !peaks.length) return;

    const committed = zonesRef.current;
    const draft = draftRef.current;
    const allZones = draft ? [...committed, draft] : committed;
    const activeDrawIdx = draft ? allZones.length - 1 : activeIdxRef.current;
    const pp = playPosRef.current;

    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, CW, CH);

    // Waveform bars — orange where inside any zone
    const barW = 2;
    for (let i = 0; i < CW; i += barW) {
      const peak  = peaks[Math.round(i * peaks.length / CW)] ?? 0;
      const barH  = Math.max(2, peak * (CH - 24));
      const t     = (i / CW) * dur;
      const inZone = allZones.some(z => t >= z.start && t <= z.end);
      ctx.fillStyle = inZone ? '#f97316' : '#252540';
      ctx.fillRect(i, (CH - 8 - barH) / 2 + 4, barW - 1, barH);
    }

    // Zone overlays
    allZones.forEach((z, i) => {
      const isActive = i === activeDrawIdx;
      const sx1 = (z.start / dur) * CW;
      const sx2 = (z.end / dur) * CW;

      ctx.fillStyle = isActive ? 'rgba(249,115,22,0.10)' : 'rgba(249,115,22,0.05)';
      ctx.fillRect(sx1, 0, sx2 - sx1, CH - 18);

      ctx.lineWidth   = isActive ? 2 : 1.5;
      ctx.strokeStyle = isActive ? '#fbbf24' : 'rgba(249,115,22,0.65)';
      ctx.setLineDash([]);
      [sx1, sx2].forEach(x => {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH - 18); ctx.stroke();
      });

      // Drag handles — pill grip at top
      [[sx1, 1], [sx2, -1]].forEach(([x, dir]) => {
        const cx  = x as number;
        const d   = dir as number;
        const pw  = 16;
        const ph  = 20;
        const rx  = d > 0 ? cx : cx - pw;
        ctx.fillStyle = isActive ? '#fbbf24' : 'rgba(249,115,22,0.75)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(rx, 0, pw, ph, 5);
        else { ctx.rect(rx, 0, pw, ph); }
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth   = 1.5;
        for (let g = 0; g < 3; g++) {
          const lx = cx + d * (4 + g * 3);
          ctx.beginPath(); ctx.moveTo(lx, 5); ctx.lineTo(lx, ph - 5); ctx.stroke();
        }
      });

      // Zone number label
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font      = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}`, sx1 + 3, 12);
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
      playEndRef.current
    );
    drawCanvas();
    if (playPosRef.current < playEndRef.current) {
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
    zonesRef.current        = [];
    draftRef.current        = null;
    playPosRef.current     = 0;
    peaksRef.current       = computePeaks(buf, CW);
    setDuration(buf.duration);
    setZones([]);
    selectZone(null);
    setFileName(file.name.replace(/\.[^.]+$/, ''));
    setWavUrl(null); setLoaded(true);
  }

  // ── Play / Stop ────────────────────────────────────────────────────────────
  async function play(from: number, to: number) {
    const buf  = audioBufferRef.current;
    const actx = audioCtxRef.current;
    if (!buf || !actx || to <= from) return;
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
    playEndRef.current     = to;
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

  // ── Canvas mouse (drag handles, select zone, or create new zone) ───────────
  const HANDLE_SNAP = 14; // px within which a click grabs a handle

  function getCanvasX(e: React.MouseEvent<HTMLCanvasElement>): number {
    const rect = e.currentTarget.getBoundingClientRect();
    return (e.clientX - rect.left) * (CW / rect.width);
  }

  function getTime(e: React.MouseEvent<HTMLCanvasElement>): number {
    const x = getCanvasX(e);
    return Math.max(0, Math.min(durationRef.current, (x / CW) * durationRef.current));
  }

  function hitTest(canvasX: number): { idx: number; mode: 'start' | 'end' | 'body' | 'new' } {
    const dur = durationRef.current;
    if (!dur) return { idx: -1, mode: 'new' };
    const zs = zonesRef.current;
    for (let i = 0; i < zs.length; i++) {
      const sx1 = (zs[i].start / dur) * CW;
      if (Math.abs(canvasX - sx1) <= HANDLE_SNAP) return { idx: i, mode: 'start' };
    }
    for (let i = 0; i < zs.length; i++) {
      const sx2 = (zs[i].end / dur) * CW;
      if (Math.abs(canvasX - sx2) <= HANDLE_SNAP) return { idx: i, mode: 'end' };
    }
    for (let i = 0; i < zs.length; i++) {
      const sx1 = (zs[i].start / dur) * CW;
      const sx2 = (zs[i].end / dur) * CW;
      if (canvasX >= sx1 && canvasX <= sx2) return { idx: i, mode: 'body' };
    }
    return { idx: -1, mode: 'new' };
  }

  function cursorFor(mode: 'start' | 'end' | 'body' | 'new'): string {
    return mode === 'start' || mode === 'end' ? 'ew-resize' : mode === 'body' ? 'pointer' : 'crosshair';
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!loaded) return;
    stopAudio();
    const cx  = getCanvasX(e);
    const t   = getTime(e);
    const hit = hitTest(cx);

    if (hit.mode === 'start' || hit.mode === 'end') {
      dragModeRef.current = hit.mode;
      dragIdxRef.current  = hit.idx;
      selectZone(hit.idx);
    } else if (hit.mode === 'body') {
      dragModeRef.current = null;
      selectZone(hit.idx);
    } else {
      dragModeRef.current   = 'new';
      dragAnchorRef.current = t;
      draftRef.current      = { start: t, end: t };
    }
    setCanvasCursor(cursorFor(hit.mode));
    drawCanvas();
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const cx = getCanvasX(e);
    const t  = getTime(e);

    if (dragModeRef.current === null) {
      setCanvasCursor(cursorFor(hitTest(cx).mode));
      return;
    }

    const dur = durationRef.current;
    if (dragModeRef.current === 'start' && dragIdxRef.current !== null) {
      const z = zonesRef.current[dragIdxRef.current];
      z.start = Math.max(0, Math.min(t, z.end - 0.05));
    } else if (dragModeRef.current === 'end' && dragIdxRef.current !== null) {
      const z = zonesRef.current[dragIdxRef.current];
      z.end = Math.min(dur, Math.max(t, z.start + 0.05));
    } else if (dragModeRef.current === 'new') {
      const a = dragAnchorRef.current!;
      draftRef.current = { start: Math.min(a, t), end: Math.max(a, t) };
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
      const draft = draftRef.current;
      draftRef.current = null;
      // Only keep the zone if the drag was more than a tiny click
      if (draft && Math.abs(t - a) * CW / (durationRef.current || 1) >= 4) {
        zonesRef.current = [...zonesRef.current, draft];
        selectZone(zonesRef.current.length - 1);
      }
    }

    dragModeRef.current = null;
    dragIdxRef.current  = null;
    setCanvasCursor(cursorFor(hitTest(getCanvasX(e)).mode));
    setZones([...zonesRef.current]);
    setWavUrl(null);
    drawCanvas();
  }

  function deleteZone(i: number) {
    zonesRef.current = zonesRef.current.filter((_, idx) => idx !== i);
    setZones([...zonesRef.current]);
    const prev = activeIdxRef.current;
    if (prev !== null) {
      if (prev === i) selectZone(null);
      else if (prev > i) selectZone(prev - 1);
    }
    setWavUrl(null);
    drawCanvas();
  }

  // ── Precise input fields (edit the active zone) ─────────────────────────────
  function onStartInput(v: string) {
    const i = activeIdxRef.current;
    if (i === null) return;
    const n = parseFloat(v);
    if (isNaN(n)) return;
    const z = zonesRef.current[i];
    z.start = Math.max(0, Math.min(z.end - 0.01, n));
    setZones([...zonesRef.current]); setWavUrl(null); drawCanvas();
  }

  function onEndInput(v: string) {
    const i = activeIdxRef.current;
    if (i === null) return;
    const n = parseFloat(v);
    if (isNaN(n)) return;
    const z = zonesRef.current[i];
    z.end = Math.min(durationRef.current, Math.max(z.start + 0.01, n));
    setZones([...zonesRef.current]); setWavUrl(null); drawCanvas();
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  async function exportMp3() {
    const buf = audioBufferRef.current;
    if (!buf || encoding) return;
    const merged = mergeZones(zonesRef.current);
    if (!merged.length) return;
    if (wavUrl) URL.revokeObjectURL(wavUrl);
    setEncoding(true); setEncProgress(0);
    const blob = await encodeMp3Async(buf, merged, setEncProgress);
    const url  = URL.createObjectURL(blob);
    const name = `${fileName}_recortado.mp3`;
    setWavUrl(url); setWavName(name);
    setEncoding(false);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
  }

  const mergedZones = mergeZones(zones);
  const totalSelDur = mergedZones.reduce((s, z) => s + (z.end - z.start), 0);
  const outputDur = totalSelDur + GAP_SEC * Math.max(0, mergedZones.length - 1);
  const canCut  = loaded && totalSelDur > 0.05;
  const activeZone = activeIdx !== null ? zones[activeIdx] : null;
  // Estimated MP3 size at 128 kbps, including the silence gaps between fragments
  const estMB   = (outputDur * 16000) / (1024 * 1024);

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
          Arrastra sobre la forma de onda para marcar una o varias zonas — se exportan unidas en un solo archivo
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
                onMouseLeave={e => { if (dragModeRef.current !== null) onMouseUp(e); }}
              />
            </div>

            {/* Zone chips */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {zones.length === 0 && (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Sin zonas todavía — arrastra sobre la forma de onda para crear una.
                </span>
              )}
              {zones.map((z, i) => (
                <div key={i}
                  onClick={() => selectZone(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.3rem 0.6rem', borderRadius: 8, cursor: 'pointer',
                    background: activeIdx === i ? 'rgba(249,115,22,0.18)' : 'var(--surface)',
                    border: `1px solid ${activeIdx === i ? '#f97316' : 'var(--border)'}`,
                    fontSize: '0.8rem',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>#{i + 1}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{fmt(z.start)} – {fmt(z.end)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteZone(i); }}
                    style={{
                      background: 'none', border: 'none', color: 'var(--text-muted)',
                      cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1, padding: '0 0.1rem',
                    }}
                    title="Eliminar zona"
                  >×</button>
                </div>
              ))}
            </div>

            {/* Selection time controls */}
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap' }}>
              {activeZone ? (
                [
                  { label: 'Inicio', val: activeZone.start, ref: 'start' },
                  { label: 'Fin',    val: activeZone.end,   ref: 'end'   },
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
                ))
              ) : (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Selecciona una zona para editar sus tiempos con precisión.
                </span>
              )}
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f97316', marginLeft: 'auto' }}>
                ✂️ {fmt(totalSelDur)} en {mergedZones.length} zona{mergedZones.length === 1 ? '' : 's'}
                <span style={{ fontSize: '0.78rem', color: 'rgba(249,115,22,0.7)', marginLeft: '0.5rem', fontWeight: 400 }}>
                  ({fmt(outputDur)} final con gaps · ~{estMB < 0.1 ? '<0.1' : estMB.toFixed(1)} MB)
                </span>
              </span>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
              <button className="kk-mode-btn" onClick={() => play(0, durationRef.current)}>
                ▶ Escuchar todo
              </button>
              <button className="kk-mode-btn active" onClick={() => activeZone && play(activeZone.start, activeZone.end)}
                disabled={!activeZone}>
                ▶ Escuchar zona
              </button>
              {playing && (
                <button className="kk-btn" style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
                  onClick={stopAudio}>⏹ Detener</button>
              )}
              <button
                className="kk-btn primary"
                onClick={exportMp3}
                disabled={!canCut || encoding}
                style={{ marginLeft: 'auto', opacity: (canCut && !encoding) ? 1 : 0.4 }}
              >
                {encoding ? `⏳ Codificando… ${encProgress}%` : '✂️ Recortar y descargar .mp3'}
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
          💡 Arrastra en una zona vacía para crear una nueva marca · Arrastra los extremos de una marca para ajustarla ·
          Haz clic en una marca (o su chip) para seleccionarla y editar sus tiempos · Usa la × para eliminarla ·
          Todas las zonas se exportan unidas, en orden cronológico, con {GAP_SEC}s de silencio entre cada una, como un solo <strong>.mp3</strong>
        </div>
      </div>
    </div>
  );
}
