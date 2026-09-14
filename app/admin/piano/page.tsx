'use client';
import { useRef, useState, useEffect, useCallback } from 'react';

// ─── Note math ───────────────────────────────────────────────────────────────
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const MIDI_LOW  = 36; // C2
const MIDI_HIGH = 95; // B6  (5 octaves, 35 white keys)

function isBlack(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
}
function noteHue(midi: number): number {
  return (((midi % 12) + 12) % 12) * 30;
}
// Color scheme: warm gold for white keys, cool blue for black keys
function keyHue(midi: number): number { return isBlack(midi) ? 210 : 42; }
function noteColor(midi: number, l = 62): string {
  return `hsl(${keyHue(midi)}, 80%, ${l}%)`;
}
function noteColorA(midi: number, l = 62, a = 1): string {
  return `hsla(${keyHue(midi)}, 80%, ${l}%, ${a})`;
}
function midiToName(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}
function freqToMidi(freq: number): number {
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

// ─── Canvas constants ─────────────────────────────────────────────────────────
const W = 1000, H = 420;
const TRAIL_H = 158;
const KEYS_Y  = 165;

// Count white keys in range
let _wc = 0;
for (let m = MIDI_LOW; m <= MIDI_HIGH; m++) if (!isBlack(m)) _wc++;
const WHITE_W = Math.floor((W - 4) / _wc);          // ~28 px
const KEYS_X  = Math.floor((W - WHITE_W * _wc) / 2); // left margin to center
const WHITE_H = H - KEYS_Y - 6;
const BLACK_W = Math.round(WHITE_W * 0.60);
const BLACK_H = Math.round(WHITE_H * 0.62);

// Precompute x positions of every key
const whiteX: Record<number, number> = {};
const blackX: Record<number, number> = {};
{
  let wi = 0;
  for (let m = MIDI_LOW; m <= MIDI_HIGH; m++) {
    if (!isBlack(m)) { whiteX[m] = KEYS_X + wi * WHITE_W; wi++; }
  }
  for (let m = MIDI_LOW; m <= MIDI_HIGH; m++) {
    if (isBlack(m)) {
      let lm = m - 1; while (isBlack(lm)) lm--;
      blackX[m] = whiteX[lm] + WHITE_W - Math.round(BLACK_W / 2);
    }
  }
}
function keyLeft(midi: number): number { return isBlack(midi) ? (blackX[midi] ?? 0) : (whiteX[midi] ?? 0); }
function keyCX(midi: number):   number { return keyLeft(midi) + (isBlack(midi) ? BLACK_W : WHITE_W) / 2; }

// ─── Pitch detection (wide piano range: ~27 Hz – 4200 Hz) ────────────────────
function detectPitch(buf: Float32Array, sr: number): number | null {
  const N = buf.length;
  let rms = 0;
  for (let i = 0; i < N; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / N) < 0.010) return null;
  const minOff = Math.floor(sr / 4200);
  const maxOff = Math.ceil(sr / 27);
  const inner  = Math.floor(N / 2);
  let best = -1, bestC = 0, lastC = 1, found = false;
  for (let o = minOff; o <= Math.min(maxOff, N - inner - 1); o++) {
    let c = 0;
    for (let i = 0; i < inner; i++) c += Math.abs(buf[i] - buf[i + o]);
    c = 1 - c / inner;
    if (c > 0.85 && c > lastC) {
      found = true;
      if (c > bestC) { bestC = c; best = o; }
    } else if (found) break;
    lastC = c;
  }
  return best > 0 ? sr / best : null;
}

// ─── Trail entry type ─────────────────────────────────────────────────────────
interface TrailEntry { midi: number; alpha: number; cx: number }

// ─── Component ────────────────────────────────────────────────────────────────
export default function PianoPage() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const animRef      = useRef<number>(0);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const timeBufRef   = useRef<Float32Array<ArrayBuffer> | null>(null);
  const sourceRef    = useRef<AudioBufferSourceNode | MediaStreamAudioSourceNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioFileRef = useRef<File | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recRef       = useRef<MediaRecorder | null>(null);
  const chunksRef    = useRef<BlobPart[]>([]);
  const videoBlobUrlRef = useRef('');

  // Per-key glow intensity (midi -> 0–1, decays when key not active)
  const keyGlowRef   = useRef<Record<number, number>>({});
  // Per-key press age: frames since onset (0=just pressed, increases; -1=idle)
  // Used ONLY for the physical press-down animation, independent of glow
  const keyPressAgeRef = useRef<Record<number, number>>({});
  // Trail bars above keyboard
  const trailRef     = useRef<TrailEntry[]>([]);
  const prevMidiRef  = useRef<number | null>(null);
  const lastLabelRef = useRef('');

  const speedRef       = useRef<number>(1);
  const inputTypeRef   = useRef<'file' | 'mic'>('file');
  const frameCountRef  = useRef(0);
  const lastFrameTsRef = useRef(0);
  const cachedMidiRef  = useRef<number | null>(null);
  const cachedFreqRef  = useRef<number | null>(null);

  const [inputType, setInputType] = useState<'file' | 'mic'>('file');
  const [running, setRunning]         = useState(false);
  const [fileReady, setFileReady]     = useState(false);
  const [recording, setRecording]     = useState(false);
  const [blobUrl, setBlobUrl]         = useState<string | null>(null);
  const [convertingMp4, setConvertingMp4] = useState(false);
  const [isNativeMp4, setIsNativeMp4]     = useState(false);
  const [audioName, setAudioName]     = useState('');
  const [detectedNote, setDetectedNote] = useState('');
  const [speed, setSpeed] = useState<1 | 0.75 | 0.5 | 0.25>(1);

  const drawFrame = useCallback((ts: number = 0) => {
    // ── Throttle to ~30 fps ──────────────────────────────────────────────────
    if (ts - lastFrameTsRef.current < 30) {
      animRef.current = requestAnimationFrame(drawFrame); return;
    }
    lastFrameTsRef.current = ts;

    const canvas = canvasRef.current;
    if (!canvas) { animRef.current = requestAnimationFrame(drawFrame); return; }
    const ctx = canvas.getContext('2d');
    if (!ctx)   { animRef.current = requestAnimationFrame(drawFrame); return; }

    // ── Pitch detection (run every 2 frames, cache result) ───────────────────
    frameCountRef.current = (frameCountRef.current + 1) % 2;
    if (frameCountRef.current === 0 && analyserRef.current && timeBufRef.current) {
      analyserRef.current.getFloatTimeDomainData(timeBufRef.current);
      let freq = detectPitch(timeBufRef.current, analyserRef.current.context.sampleRate);
      if (freq !== null && inputTypeRef.current === 'file' && speedRef.current < 1) {
        freq *= (1 / speedRef.current);
      }
      if (freq !== null) {
        const m = freqToMidi(freq);
        cachedMidiRef.current = (m >= MIDI_LOW && m <= MIDI_HIGH) ? m : null;
        cachedFreqRef.current = freq;
      } else {
        cachedMidiRef.current = null;
        cachedFreqRef.current = null;
      }
    }
    const activeMidi  = cachedMidiRef.current;
    const detectedFreq = cachedFreqRef.current;

    // ── Update glow (color tint, represents the sustaining sound) ───────────
    const glow = keyGlowRef.current;
    for (const k of Object.keys(glow)) {
      const m = Number(k);
      glow[m] = m === activeMidi
        ? Math.min(1, glow[m] + 0.30)
        : glow[m] * 0.72;
      if (glow[m] < 0.01) delete glow[m];
    }
    if (activeMidi !== null && !(activeMidi in glow)) glow[activeMidi] = 0.30;

    // ── Update press-down age (physical key animation only) ──────────────────
    // Press lasts ~18 frames: 0-8 going down, 8-18 coming back up
    const pressAge = keyPressAgeRef.current;
    for (const k of Object.keys(pressAge)) {
      pressAge[Number(k)] += 1;
      if (pressAge[Number(k)] > 18) delete pressAge[Number(k)];
    }
    // New onset: reset press animation for this key
    if (activeMidi !== null && activeMidi !== prevMidiRef.current) {
      pressAge[activeMidi] = 0;
    }

    // ── Update trail bars ────────────────────────────────────────────────────
    const trail = trailRef.current;
    // Decay all
    for (const t of trail) {
      if (t.midi === activeMidi) t.alpha = Math.min(0.90, t.alpha + 0.06);
      else t.alpha *= 0.972;
    }
    trailRef.current = trail.filter(t => t.alpha > 0.025);
    // New note onset → new trail entry
    if (activeMidi !== null && activeMidi !== prevMidiRef.current) {
      // Remove stale entry for this midi if nearly faded
      trailRef.current = trailRef.current.filter(t => !(t.midi === activeMidi && t.alpha < 0.40));
      trailRef.current.push({ midi: activeMidi, alpha: 0.80, cx: keyCX(activeMidi) });
      // Cap history
      if (trailRef.current.length > 24) trailRef.current = trailRef.current.slice(-24);
    }
    prevMidiRef.current = activeMidi;

    // ════════ DRAW ════════════════════════════════════════════════════════════

    // ── Background ──────────────────────────────────────────────────────────
    ctx.fillStyle = '#080810';
    ctx.fillRect(0, 0, W, H);

    // ── Trail area BG ────────────────────────────────────────────────────────
    const tBg = ctx.createLinearGradient(0, 0, 0, TRAIL_H);
    tBg.addColorStop(0, '#0b0b1a');
    tBg.addColorStop(1, '#0f0f1f');
    ctx.fillStyle = tBg;
    ctx.fillRect(0, 0, W, TRAIL_H);

    // Faint vertical guide lines at every white key center
    ctx.strokeStyle = 'rgba(80,80,140,0.10)';
    ctx.lineWidth   = 1;
    for (let m = MIDI_LOW; m <= MIDI_HIGH; m++) {
      if (!isBlack(m)) {
        const cx = keyCX(m);
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, TRAIL_H); ctx.stroke();
      }
    }

    // Trail bars — glow pillars rising from keyboard divider
    for (const t of trailRef.current) {
      const barH  = Math.round(t.alpha * TRAIL_H * 0.88);
      const barW  = isBlack(t.midi) ? BLACK_W + 6 : WHITE_W - 6;
      const color = noteColor(t.midi, 58);
      // Gradient: transparent at bottom, full color at top of bar
      const barGrad = ctx.createLinearGradient(0, TRAIL_H - barH, 0, TRAIL_H);
      barGrad.addColorStop(0,   color);
      barGrad.addColorStop(0.6, noteColor(t.midi, 48));
      barGrad.addColorStop(1,   'transparent');
      ctx.fillStyle   = barGrad;
      ctx.globalAlpha = t.alpha * 0.65;
      ctx.shadowColor = color;
      ctx.shadowBlur  = 14;
      ctx.fillRect(t.cx - barW / 2, TRAIL_H - barH, barW, barH);
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    // ── Large note name centered in trail area ───────────────────────────────
    if (activeMidi !== null) {
      const g    = glow[activeMidi] ?? 0.5;
      const name = NOTE_NAMES[((activeMidi % 12) + 12) % 12];
      const oct  = String(Math.floor(activeMidi / 12) - 1);
      const cx   = W / 2;
      const cy   = TRAIL_H / 2;

      // Soft radial halo behind note name
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
      rg.addColorStop(0,   noteColorA(activeMidi, 35, 0.80));
      rg.addColorStop(0.5, noteColorA(activeMidi, 25, 0.33));
      rg.addColorStop(1,   'transparent');
      ctx.fillStyle   = rg;
      ctx.globalAlpha = g * 0.8;
      ctx.fillRect(cx - 90, cy - 60, 180, 120);
      ctx.globalAlpha = 1;

      // Note letter (large)
      ctx.font        = 'bold 74px "Inter", sans-serif';
      ctx.textAlign   = 'center';
      ctx.fillStyle   = noteColor(activeMidi, 88);
      ctx.shadowColor = noteColor(activeMidi);
      ctx.shadowBlur  = 32;
      ctx.globalAlpha = Math.min(1, g + 0.25);
      ctx.fillText(name, cx - 14, cy + 24);
      ctx.shadowBlur  = 0;

      // Octave (small, to the right of the note name)
      ctx.font        = 'bold 28px "Inter", sans-serif';
      ctx.fillStyle   = noteColor(activeMidi, 70);
      ctx.shadowColor = noteColor(activeMidi);
      ctx.shadowBlur  = 10;
      ctx.fillText(oct, cx + 34, cy + 10);
      ctx.shadowBlur  = 0; ctx.globalAlpha = 1;

      // Frequency below
      if (detectedFreq !== null) {
        ctx.font      = '12px "Inter", sans-serif';
        ctx.fillStyle = 'rgba(200,200,240,0.55)';
        ctx.shadowBlur = 0;
        ctx.fillText(`${Math.round(detectedFreq)} Hz`, cx, cy + 50);
      }
    }

    // Divider between trail and keys
    ctx.strokeStyle = 'rgba(90,90,150,0.30)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(0, TRAIL_H + 2); ctx.lineTo(W, TRAIL_H + 2); ctx.stroke();

    // ── White keys ───────────────────────────────────────────────────────────
    for (let m = MIDI_LOW; m <= MIDI_HIGH; m++) {
      if (isBlack(m)) continue;
      const x   = whiteX[m];
      const g   = glow[m] ?? 0;
      const age = pressAge[m] ?? -1;
      // Physical press offset: bell curve peaking at frame 8, gone by frame 18
      const pressOff = age >= 0 ? Math.round(3 * Math.sin((age / 18) * Math.PI)) : 0;
      const kH  = WHITE_H - pressOff;
      const py  = KEYS_Y + pressOff;

      // Key gradient: colored while glow > 0, ivory otherwise
      const kg = ctx.createLinearGradient(x, py, x + WHITE_W, py + kH);
      if (g > 0.04) {
        const h = keyHue(m);
        kg.addColorStop(0,    `hsla(${h},90%,93%,1)`);
        kg.addColorStop(0.35, `hsla(${h},85%,82%,1)`);
        kg.addColorStop(0.80, `hsla(${h},82%,68%,${0.50 + g * 0.50})`);
        kg.addColorStop(1,    `hsla(${h},78%,50%,1)`);
        ctx.shadowColor = noteColor(m, 68);
        ctx.shadowBlur  = 18 * g;
      } else {
        kg.addColorStop(0,   '#f7f3ec');
        kg.addColorStop(0.7, '#eae6de');
        kg.addColorStop(1,   '#d6d2ca');
      }
      ctx.fillStyle = kg;
      ctx.beginPath();
      ctx.roundRect(x + 1, py, WHITE_W - 2, kH, [0, 0, 5, 5]);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Key border
      ctx.strokeStyle = g > 0.04 ? noteColor(m, 50) : 'rgba(90,80,70,0.40)';
      ctx.lineWidth   = g > 0.04 ? 1.5 : 0.8;
      ctx.beginPath();
      ctx.roundRect(x + 1, py, WHITE_W - 2, kH, [0, 0, 5, 5]);
      ctx.stroke();

      // Note label: C notes always, all notes in learning mode
      const semi = ((m % 12) + 12) % 12;
      const showLabel = semi === 0 || speedRef.current < 1;
      if (showLabel) {
        ctx.font      = speedRef.current < 1 ? 'bold 9px Inter, sans-serif' : '8px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = g > 0.04 ? 'rgba(0,0,0,0.65)' : 'rgba(90,78,65,0.50)';
        ctx.fillText(NOTE_NAMES[semi], x + WHITE_W / 2, py + kH - 8);
      }
    }

    // ── Black keys (drawn on top of white) ───────────────────────────────────
    for (let m = MIDI_LOW; m <= MIDI_HIGH; m++) {
      if (!isBlack(m)) continue;
      const x   = blackX[m];
      const g   = glow[m] ?? 0;
      const age = pressAge[m] ?? -1;
      const pressOff = age >= 0 ? Math.round(2 * Math.sin((age / 18) * Math.PI)) : 0;
      const kH  = BLACK_H - pressOff;
      const py  = KEYS_Y + pressOff;

      const kg = ctx.createLinearGradient(x, py, x, py + kH);
      if (g > 0.04) {
        const h = keyHue(m);
        kg.addColorStop(0,   `hsla(${h},85%,58%,1)`);
        kg.addColorStop(0.5, `hsla(${h},80%,40%,1)`);
        kg.addColorStop(1,   `hsla(${h},75%,25%,1)`);
        ctx.shadowColor = noteColor(m, 55);
        ctx.shadowBlur  = 18 * g;
      } else {
        kg.addColorStop(0,   '#2c2a26');
        kg.addColorStop(0.55,'#1c1a17');
        kg.addColorStop(1,   '#0e0d0b');
      }
      ctx.fillStyle = kg;
      ctx.beginPath();
      ctx.roundRect(x, py, BLACK_W, kH, [0, 0, 4, 4]);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Sheen on top (only when not colored)
      if (g <= 0.04) {
        ctx.fillStyle   = 'rgba(255,255,255,0.07)';
        ctx.beginPath();
        ctx.roundRect(x + 2, KEYS_Y, BLACK_W - 4, kH * 0.28, 2);
        ctx.fill();
      }

      // Label in learning mode
      if (speedRef.current < 1) {
        const semi = ((m % 12) + 12) % 12;
        ctx.font      = '7px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = g > 0.04 ? 'rgba(255,255,255,0.90)' : 'rgba(200,190,170,0.50)';
        ctx.fillText(NOTE_NAMES[semi], x + BLACK_W / 2, py + kH - 6);
      }
    }

    // ── Active key outer glow ring (pulse while held) ─────────────────────
    if (activeMidi !== null) {
      const g  = glow[activeMidi] ?? 0;
      const kx = keyLeft(activeMidi);
      const kw = isBlack(activeMidi) ? BLACK_W : WHITE_W;
      const kh = isBlack(activeMidi) ? BLACK_H : WHITE_H;
      ctx.strokeStyle = noteColor(activeMidi, 72);
      ctx.lineWidth   = 2.5;
      ctx.globalAlpha = g * 0.8;
      ctx.shadowColor = noteColor(activeMidi);
      ctx.shadowBlur  = 28;
      ctx.beginPath();
      ctx.roundRect(kx - 3, KEYS_Y - 3, kw + 6, kh + 6, 6);
      ctx.stroke();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    // ── Learning mode: speed badge ───────────────────────────────────────────
    if (speedRef.current < 1) {
      const sl = speedRef.current >= 0.75 ? '0.75x' : speedRef.current >= 0.5 ? '0.5x LENTO' : '0.25x MUY LENTO';
      ctx.font        = 'bold 11px "Inter", sans-serif';
      ctx.textAlign   = 'left';
      ctx.fillStyle   = '#fbbf24';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur  = 8;
      ctx.fillText(`🎓 APRENDIZAJE  ${sl}`, 14, 22);
      ctx.shadowBlur  = 0;
    }

    // ── Detected note state update ───────────────────────────────────────────
    if (activeMidi !== null && detectedFreq !== null) {
      const label = `${midiToName(activeMidi)}  ·  ${Math.round(detectedFreq)} Hz`;
      if (label !== lastLabelRef.current) {
        lastLabelRef.current = label;
        setDetectedNote(label);
      }
    } else if (activeMidi === null && lastLabelRef.current !== '') {
      lastLabelRef.current = '';
      setDetectedNote('');
    }

    animRef.current = requestAnimationFrame(drawFrame);
  }, []);

  useEffect(() => {
    animRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(animRef.current);
  }, [drawFrame]);

  useEffect(() => { inputTypeRef.current = inputType; }, [inputType]);
  useEffect(() => {
    speedRef.current = speed;
    const src = sourceRef.current as AudioBufferSourceNode | null;
    if (src && 'playbackRate' in src && src.playbackRate) src.playbackRate.value = speed;
  }, [speed]);

  function stopAudio() {
    if (recRef.current?.state !== 'inactive') recRef.current?.stop();
    recRef.current = null;
    try { (sourceRef.current as AudioBufferSourceNode)?.stop?.(); } catch {}
    sourceRef.current = null;
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current  = null;
    audioCtxRef.current?.close();
    audioCtxRef.current   = null;
    analyserRef.current   = null;
    audioDestRef.current  = null;
    timeBufRef.current    = null;
    keyGlowRef.current    = {};
    keyPressAgeRef.current = {};
    trailRef.current      = [];
    prevMidiRef.current   = null;
    setRunning(false);
    setRecording(false);
    setDetectedNote('');
    lastLabelRef.current = '';
  }

  function buildAudioGraph(actx: AudioContext) {
    const analyser = actx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.4;
    analyserRef.current = analyser;
    timeBufRef.current  = new Float32Array(analyser.fftSize);
    const dest = actx.createMediaStreamDestination();
    audioDestRef.current = dest;
    analyser.connect(dest);
    analyser.connect(actx.destination);
    return analyser;
  }

  async function startFile(file: File) {
    stopAudio();
    const actx   = new AudioContext();
    audioCtxRef.current = actx;
    const analyser = buildAudioGraph(actx);
    const decoded  = await actx.decodeAudioData(await file.arrayBuffer());
    const src      = actx.createBufferSource();
    src.buffer     = decoded;
    src.playbackRate.value = speedRef.current;
    src.connect(analyser);
    src.onended = () => setRunning(false);
    src.start();
    sourceRef.current = src;
    setRunning(true);
  }

  async function startMic() {
    stopAudio();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    micStreamRef.current = stream;
    const actx   = new AudioContext();
    audioCtxRef.current = actx;
    const analyser = buildAudioGraph(actx);
    const src = actx.createMediaStreamSource(stream);
    src.connect(analyser);
    sourceRef.current = src as unknown as MediaStreamAudioSourceNode;
    setRunning(true);
  }

  async function playFile() {
    const file = audioFileRef.current;
    if (!file || running) return;
    await startFile(file);
  }

  function _startMediaRecorder() {
    const canvas = canvasRef.current;
    if (!canvas || !audioDestRef.current) return;
    chunksRef.current = [];
    setBlobUrl(null);
    const combined = new MediaStream([
      ...canvas.captureStream(30).getVideoTracks(),
      ...audioDestRef.current.stream.getAudioTracks(),
    ]);
    const mimeType =
      MediaRecorder.isTypeSupported('video/mp4;codecs=h264,aac')  ? 'video/mp4;codecs=h264,aac'  :
      MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a') ? 'video/mp4;codecs=avc1,mp4a' :
      MediaRecorder.isTypeSupported('video/mp4')                  ? 'video/mp4'                  :
      MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' :
      'video/webm';
    setIsNativeMp4(mimeType.startsWith('video/mp4'));
    const rec = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 5_000_000 });
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      if (videoBlobUrlRef.current) URL.revokeObjectURL(videoBlobUrlRef.current);
      const url = URL.createObjectURL(blob);
      videoBlobUrlRef.current = url;
      setBlobUrl(url);
      setRecording(false);
    };
    recRef.current = rec;
    rec.start(200);
    setRecording(true);
  }

  async function startRecord() {
    if (inputType === 'file' && !running && audioFileRef.current) {
      await startFile(audioFileRef.current);
    }
    _startMediaRecorder();
  }

  function stopRecord() {
    if (recRef.current?.state !== 'inactive') recRef.current?.stop();
  }

  function downloadVideo() {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl; a.download = isNativeMp4 ? 'piano.mp4' : 'piano.webm'; a.click();
  }

  async function downloadMp4() {
    if (!blobUrl || convertingMp4) return;
    setConvertingMp4(true);
    try {
      const blob = await fetch(blobUrl).then(r => r.blob());
      const form = new FormData();
      form.append('video', blob, isNativeMp4 ? 'piano.mp4' : 'piano.webm');
      const res  = await fetch('/api/convert-to-mp4', { method: 'POST', body: form });
      if (!res.ok) { alert('Error al convertir a MP4'); return; }
      const mp4Blob = await res.blob();
      const url     = URL.createObjectURL(mp4Blob);
      const a       = document.createElement('a');
      a.href = url; a.download = 'piano.mp4'; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error de conexión al convertir'); }
    finally  { setConvertingMp4(false); }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    stopAudio();
    setBlobUrl(null);
    audioFileRef.current = f;
    setAudioName(f.name);
    setInputType('file');
    setFileReady(true);
  }

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
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.3rem' }}>
          🎹 Visualizador de Piano
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
          Sube un audio de piano o usa el micrófono — ve las teclas presionarse en tiempo real
        </p>

        {/* Row 1: fuente de audio */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' }}>
          <button className={`kk-mode-btn${fileReady && inputType === 'file' ? ' active' : ''}`}
            onClick={() => document.getElementById('piano-audio-in')?.click()}>
            🎵 {audioName || 'Subir audio'}
          </button>
          <input id="piano-audio-in" type="file" accept="audio/*"
            style={{ display: 'none' }} onChange={onFileChange} />

          <button
            className={`kk-mode-btn${inputType === 'mic' && running ? ' active' : ''}`}
            style={inputType === 'mic' && running ? { borderColor: 'var(--success)', color: 'var(--success)' } : {}}
            onClick={inputType === 'mic' && running
              ? stopAudio
              : () => { setInputType('mic'); setFileReady(false); startMic(); }}>
            {inputType === 'mic' && running ? '⏹ Detener mic' : '🎙 Micrófono en vivo'}
          </button>

          <span style={{ width: 1, height: 26, background: 'var(--border)', display: 'inline-block' }} />

          {inputType === 'file' && fileReady && !running && (
            <button className="kk-btn primary" onClick={playFile}>▶ Tocar</button>
          )}
          {inputType === 'file' && running && (
            <button className="kk-btn" style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
              onClick={stopAudio}>⏹ Detener</button>
          )}
        </div>

        {/* Row 2: velocidad */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>🎓 Velocidad:</span>
          {([1, 0.75, 0.5, 0.25] as const).map(s => (
            <button key={s}
              className={`kk-mode-btn${speed === s ? ' active' : ''}`}
              style={{
                minWidth: 38, padding: '0.3rem 0.6rem', fontSize: '0.82rem',
                ...(speed === s && s < 1 ? { borderColor: '#fbbf24', color: '#fbbf24' } : {}),
              }}
              onClick={() => setSpeed(s)}>
              {s === 1 ? '1x Normal' : s === 0.75 ? '0.75x' : s === 0.5 ? '0.5x Lento' : '0.25x Muy lento'}
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div style={{
          background: '#080810', borderRadius: 14,
          padding: '0.75rem', border: '1px solid var(--border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          <canvas ref={canvasRef} width={W} height={H}
            style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 8 }} />
        </div>

        {/* Grabación */}
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className={`kk-btn ${recording ? 'danger' : 'rec'}`}
            onClick={recording ? stopRecord : startRecord}
            disabled={!running && !fileReady}
            style={{ opacity: (!running && !fileReady) ? 0.45 : 1 }}>
            {recording ? '⏹ Detener grabación' : '⏺ Grabar video'}
          </button>
          {blobUrl && !recording && (
            <>
              <button className="kk-btn primary" onClick={downloadVideo}>
                ⬇ {isNativeMp4 ? 'Descargar .mp4' : 'Descargar .webm'}
              </button>
              <button className="kk-btn primary" onClick={downloadMp4} disabled={convertingMp4}>
                {convertingMp4 ? '⏳ Convirtiendo...' : '📱 Para WhatsApp (.mp4)'}
              </button>
            </>
          )}
          {recording && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
              color: '#e05d5d', fontSize: '0.83rem', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e05d5d',
                animation: 'pulse 1s infinite', display: 'inline-block' }} />
              Grabando...
            </span>
          )}
          {blobUrl && !recording && (
            <span style={{ color: 'var(--success)', fontSize: '0.83rem' }}>✓ Video listo</span>
          )}
        </div>

        {/* Status */}
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.35rem 0.85rem', borderRadius: 99, fontSize: '0.83rem',
            background: running ? 'rgba(78,201,160,0.08)' : 'var(--surface)',
            border: `1px solid ${running ? 'var(--success)' : 'var(--border)'}`,
            color: running ? 'var(--success)' : 'var(--text-muted)',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: running ? 'var(--success)' : 'var(--text-muted)',
              boxShadow: running ? '0 0 6px var(--success)' : 'none',
              animation: running ? 'pulse 1.5s infinite' : 'none',
            }} />
            {running ? 'Escuchando...' : 'Sin audio — sube un archivo o usa el micrófono'}
          </span>
          {detectedNote && (
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent-soft)' }}>
              🎹 {detectedNote}
            </span>
          )}
        </div>

        {/* Leyenda */}
        <div style={{
          marginTop: '1.25rem', padding: '0.75rem 1rem',
          background: 'var(--surface)', borderRadius: 10,
          border: '1px solid var(--border)', fontSize: '0.82rem',
          color: 'var(--text-muted)', lineHeight: 1.8,
        }}>
          Cada nota tiene su color único · Teclas iluminadas = nota activa · Barras = historial reciente · Rango: C2 – B6 (5 octavas)
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
