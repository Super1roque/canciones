'use client';
import { useRef, useState, useEffect, useCallback } from 'react';

type StringInfo = { name: string; freq: number; color: string; thickness: number };

const GUITAR_STRINGS: StringInfo[] = [
  { name: 'E4', freq: 329.63, color: '#f97316', thickness: 1.2 },
  { name: 'B3', freq: 246.94, color: '#facc15', thickness: 1.8 },
  { name: 'G3', freq: 196.00, color: '#4ade80', thickness: 2.4 },
  { name: 'D3', freq: 146.83, color: '#38bdf8', thickness: 3.2 },
  { name: 'A2', freq: 110.00, color: '#a78bfa', thickness: 4.0 },
  { name: 'E2', freq:  82.41, color: '#f472b6', thickness: 5.0 },
];

const REQUINTO_STRINGS: StringInfo[] = [
  { name: 'E5', freq: 659.25, color: '#f97316', thickness: 1.2 },
  { name: 'B4', freq: 493.88, color: '#facc15', thickness: 1.8 },
  { name: 'G4', freq: 392.00, color: '#4ade80', thickness: 2.4 },
  { name: 'D4', freq: 293.66, color: '#38bdf8', thickness: 3.2 },
  { name: 'A3', freq: 220.00, color: '#a78bfa', thickness: 4.0 },
  { name: 'E3', freq: 164.81, color: '#f472b6', thickness: 5.0 },
];

// Canvas layout
const W = 1000, H = 420;
const FRET_X1  = 105;   // nut
const FRET_X2  = 630;   // end of frets / heel of neck
const STRUM_X  = 795;   // strumming zone (over sound hole)
const STR_END  = 960;   // bridge
const STR_Y0   = 52;
const STR_SPACING = (H - 104) / 5;

// Index 0 = nut (0.0), index n = nth fret wire (proportional within FRET_X1..FRET_X2)
const FRET_POS = [0, 0.11, 0.21, 0.30, 0.38, 0.46, 0.53, 0.59, 0.65, 0.71, 0.76, 0.81, 0.86, 0.90];
const DOT_FRETS = [2, 4, 6, 9, 11];

function fretWireX(fi: number) {
  return FRET_X1 + FRET_POS[Math.min(fi, FRET_POS.length - 1)] * (FRET_X2 - FRET_X1);
}

function fingerDotX(fretNum: number): number {
  if (fretNum <= 0) return FRET_X1 - 22;
  const fi = Math.min(fretNum, FRET_POS.length - 1);
  const p0 = FRET_POS[fi - 1] ?? 0;
  const p1 = FRET_POS[fi];
  return FRET_X1 + (p0 + (p1 - p0) * 0.62) * (FRET_X2 - FRET_X1);
}

function detectPitch(buf: Float32Array, sampleRate: number): number | null {
  const N = buf.length;
  let rms = 0;
  for (let i = 0; i < N; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / N) < 0.012) return null;
  const minOffset = Math.floor(sampleRate / 1400);
  const maxOffset = Math.ceil(sampleRate / 75);
  const inner = Math.floor(N / 2);
  let bestOffset = -1, bestCorr = 0, lastCorr = 1, found = false;
  for (let offset = minOffset; offset <= Math.min(maxOffset, N - inner - 1); offset++) {
    let corr = 0;
    for (let i = 0; i < inner; i++) corr += Math.abs(buf[i] - buf[i + offset]);
    corr = 1 - corr / inner;
    if (corr > 0.88 && corr > lastCorr) {
      found = true;
      if (corr > bestCorr) { bestCorr = corr; bestOffset = offset; }
    } else if (found) break;
    lastCorr = corr;
  }
  return bestOffset > 0 ? sampleRate / bestOffset : null;
}

function closestString(freq: number, strings: StringInfo[]): number | null {
  if (!freq || freq < 60 || freq > 1500) return null;
  let best = -1, bestCents = Infinity;
  for (let i = 0; i < strings.length; i++) {
    let f = strings[i].freq;
    while (f * 1.5 < freq) f *= 2;
    while (f / 1.5 > freq) f /= 2;
    const cents = Math.abs(1200 * Math.log2(freq / f));
    if (cents < bestCents) { bestCents = cents; best = i; }
  }
  return bestCents < 180 ? best : null;
}

function calcPhysicalFret(detectedFreq: number, openFreq: number): number {
  return Math.round(12 * Math.log2(detectedFreq / openFreq));
}

export default function GuitarraPage() {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const animRef        = useRef<number>(0);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const analyserRef    = useRef<AnalyserNode | null>(null);
  const timeBufRef     = useRef<Float32Array | null>(null);
  const vibrationsRef  = useRef<number[]>([0, 0, 0, 0, 0, 0]);
  const timeRef        = useRef<number[]>([0, 0, 0, 0, 0, 0]);
  // strumAge[i]: -1 = idle, 0..60 = frames since strum triggered
  const strumAgesRef   = useRef<number[]>([-1, -1, -1, -1, -1, -1]);
  const prevActiveRef  = useRef<number | null>(null);
  const lastStrRef     = useRef<number | null>(null);
  const lastFretRef    = useRef<number>(0);
  const sourceRef      = useRef<AudioBufferSourceNode | MediaStreamAudioSourceNode | null>(null);
  const micStreamRef   = useRef<MediaStream | null>(null);
  const audioFileRef   = useRef<File | null>(null);
  const audioDestRef   = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recRef         = useRef<MediaRecorder | null>(null);
  const chunksRef      = useRef<BlobPart[]>([]);
  const videoBlobUrlRef = useRef('');
  const modeRef        = useRef<'guitarra' | 'requinto'>('guitarra');
  const capoFretRef    = useRef<number>(0);
  const lastNoteRef    = useRef('');
  const speedRef       = useRef<number>(1);
  const inputTypeRef   = useRef<'file' | 'mic'>('file');
  const frameCountRef  = useRef(0);
  const lastFrameTsRef = useRef(0);
  const cachedStrRef   = useRef<number | null>(null);
  const cachedFreqRef  = useRef<number | null>(null);

  const [mode, setMode]         = useState<'guitarra' | 'requinto'>('guitarra');
  const [capoFret, setCapoFret] = useState(0);
  const [running, setRunning]     = useState(false);
  const [fileReady, setFileReady] = useState(false);
  const [recording, setRecording]     = useState(false);
  const [blobUrl, setBlobUrl]         = useState<string | null>(null);
  const [convertingMp4, setConvertingMp4] = useState(false);
  const [isNativeMp4, setIsNativeMp4] = useState(false);
  const [audioName, setAudioName] = useState('');
  const [inputType, setInputType] = useState<'file' | 'mic'>('file');
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
    if (!ctx) { animRef.current = requestAnimationFrame(drawFrame); return; }

    const strings = modeRef.current === 'requinto' ? REQUINTO_STRINGS : GUITAR_STRINGS;
    const capo    = capoFretRef.current;

    // ── Pitch detection (every 2 frames, result cached) ──────────────────────
    frameCountRef.current = (frameCountRef.current + 1) % 2;
    if (frameCountRef.current === 0 && analyserRef.current && timeBufRef.current) {
      analyserRef.current.getFloatTimeDomainData(timeBufRef.current);
      let freq = detectPitch(timeBufRef.current, analyserRef.current.context.sampleRate);
      if (freq !== null && inputTypeRef.current === 'file' && speedRef.current < 1) {
        freq *= (1 / speedRef.current);
      }
      cachedFreqRef.current  = freq;
      cachedStrRef.current   = freq !== null ? closestString(freq, strings) : null;
    }
    let activeStr: number | null  = cachedStrRef.current;
    let detectedFreq: number | null = cachedFreqRef.current;

    // ── Detect onset → trigger strum animation ──
    if (activeStr !== null && activeStr !== prevActiveRef.current) {
      strumAgesRef.current[activeStr] = 0;
    }
    prevActiveRef.current = activeStr;

    // ── Update vibrations & strum ages ──
    const vibs  = vibrationsRef.current;
    const times = timeRef.current;
    const sages = strumAgesRef.current;
    for (let i = 0; i < 6; i++) {
      if (i === activeStr) vibs[i] = Math.min(1, vibs[i] + 0.25);
      else vibs[i] *= 0.955;
      times[i] += (0.018 + (5 - i) * 0.004) * speedRef.current;
      if (sages[i] >= 0) {
        sages[i] += 1;
        if (sages[i] > 55) sages[i] = -1;
      }
    }

    // ════════ DRAW ════════

    // ── Background ──
    ctx.fillStyle = '#110a06';
    ctx.fillRect(0, 0, W, H);

    // ── Guitar body (right of neck) ──
    const bodyGrad = ctx.createLinearGradient(FRET_X2, 0, STR_END + 30, 0);
    bodyGrad.addColorStop(0,   '#3a1a08');
    bodyGrad.addColorStop(0.3, '#4d2210');
    bodyGrad.addColorStop(0.7, '#4d2210');
    bodyGrad.addColorStop(1,   '#2e1206');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(FRET_X2, 18, STR_END - FRET_X2 + 40, H - 36);

    // Body edge / binding strips
    ctx.strokeStyle = '#7a3a10';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(FRET_X2, 18); ctx.lineTo(FRET_X2, H - 18);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,100,0.15)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(FRET_X2 + 3, 18); ctx.lineTo(FRET_X2 + 3, H - 18);
    ctx.stroke();

    // ── Sound hole ──
    const holeR = 58;
    // Outer decorative ring
    ctx.strokeStyle = '#a06030';
    ctx.lineWidth   = 5;
    ctx.beginPath();
    ctx.arc(STRUM_X, H / 2, holeR + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,80,0.25)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(STRUM_X, H / 2, holeR + 14, 0, Math.PI * 2);
    ctx.stroke();
    // Dark hole interior
    ctx.fillStyle = '#050302';
    ctx.beginPath();
    ctx.arc(STRUM_X, H / 2, holeR, 0, Math.PI * 2);
    ctx.fill();
    // Inner ring
    ctx.strokeStyle = '#6a3a14';
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.arc(STRUM_X, H / 2, holeR, 0, Math.PI * 2);
    ctx.stroke();
    // Rosette pattern (dots)
    for (let r = 0; r < 12; r++) {
      const angle = (r / 12) * Math.PI * 2;
      const rx = STRUM_X + Math.cos(angle) * (holeR + 4);
      const ry = H / 2  + Math.sin(angle) * (holeR + 4);
      ctx.fillStyle = r % 2 === 0 ? '#c07030' : '#8a4a18';
      ctx.beginPath();
      ctx.arc(rx, ry, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Bridge ──
    const bridgeX = STR_END - 12;
    const bridgeTop = STR_Y0 - 10;
    const bridgeH   = STR_SPACING * 5 + 20;
    const bridgeGrad = ctx.createLinearGradient(bridgeX, 0, bridgeX + 12, 0);
    bridgeGrad.addColorStop(0,   '#1a0c04');
    bridgeGrad.addColorStop(0.4, '#3a1a08');
    bridgeGrad.addColorStop(1,   '#150a03');
    ctx.fillStyle = bridgeGrad;
    ctx.beginPath();
    ctx.roundRect(bridgeX, bridgeTop, 12, bridgeH, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,180,60,0.3)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(bridgeX, bridgeTop, 12, bridgeH, 3);
    ctx.stroke();

    // ── Fretboard ──
    const fbGrad = ctx.createLinearGradient(FRET_X1, 0, FRET_X2, 0);
    fbGrad.addColorStop(0,   '#2a160a');
    fbGrad.addColorStop(0.5, '#3a1e0c');
    fbGrad.addColorStop(1,   '#2a160a');
    ctx.fillStyle = fbGrad;
    ctx.fillRect(FRET_X1, 18, FRET_X2 - FRET_X1, H - 36);

    // ── Fret wires ──
    ctx.lineWidth = 2.5;
    for (let fi = 0; fi < FRET_POS.length; fi++) {
      const fx   = fretWireX(fi);
      const grad = ctx.createLinearGradient(0, 20, 0, H - 20);
      grad.addColorStop(0,   '#c8a830');
      grad.addColorStop(0.5, '#ffe680');
      grad.addColorStop(1,   '#c8a830');
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(fx, 20); ctx.lineTo(fx, H - 20);
      ctx.stroke();
    }

    // ── Nut ──
    const nutGrad = ctx.createLinearGradient(FRET_X1 - 6, 0, FRET_X1 + 3, 0);
    nutGrad.addColorStop(0,   '#c8b878');
    nutGrad.addColorStop(0.5, '#f0e0a0');
    nutGrad.addColorStop(1,   '#b8a060');
    ctx.fillStyle = nutGrad;
    ctx.fillRect(FRET_X1 - 6, 18, 8, H - 36);

    // ── Fret position dots ──
    for (const df of DOT_FRETS) {
      const x1 = fretWireX(df), x2 = fretWireX(df + 1);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath();
      ctx.arc((x1 + x2) / 2, H / 2, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Capotraste ──
    if (capo > 0 && capo < FRET_POS.length) {
      const cx = fretWireX(capo);
      const cw = 14, top = 16, bot = H - 16;
      ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 12; ctx.shadowOffsetX = 4;
      const capoGrad = ctx.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
      capoGrad.addColorStop(0,    '#1a1a1a');
      capoGrad.addColorStop(0.3,  '#3a3a3a');
      capoGrad.addColorStop(0.55, '#555555');
      capoGrad.addColorStop(0.8,  '#3a3a3a');
      capoGrad.addColorStop(1,    '#111111');
      ctx.fillStyle = capoGrad;
      ctx.beginPath(); ctx.roundRect(cx - cw / 2, top, cw, bot - top, 5); ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetX = 0;
      ctx.fillStyle = '#2a0808';
      ctx.beginPath(); ctx.roundRect(cx - 3, top + 8, 6, bot - top - 16, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(cx - cw / 2 + 1, top + 1, cw - 2, bot - top - 2, 5); ctx.stroke();
      [top + 10, bot - 10].forEach(by => {
        const bGrad = ctx.createRadialGradient(cx - 1, by - 1, 1, cx, by, 5);
        bGrad.addColorStop(0, '#aaaaaa'); bGrad.addColorStop(1, '#333333');
        ctx.fillStyle = bGrad;
        ctx.beginPath(); ctx.arc(cx, by, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#222'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 3, by); ctx.lineTo(cx + 3, by);
        ctx.moveTo(cx, by - 3); ctx.lineTo(cx, by + 3);
        ctx.stroke();
      });
      ctx.save();
      ctx.translate(cx + cw / 2 + 12, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillStyle = '#888'; ctx.textAlign = 'center';
      ctx.fillText(`CAPO ${capo}`, 0, 4);
      ctx.restore();
    }

    // ── Learning mode: active fret zone highlight + large note on body ──
    if (speedRef.current < 1 && activeStr !== null && detectedFreq !== null) {
      const ls    = strings[activeStr];
      const lFret = Math.max(0, Math.min(12, calcPhysicalFret(detectedFreq, ls.freq)));
      if (lFret > 0) {
        const hx1 = fretWireX(lFret - 1);
        const hx2 = fretWireX(lFret);
        ctx.fillStyle   = ls.color;
        ctx.globalAlpha = 0.11;
        ctx.fillRect(hx1 + 1, 20, hx2 - hx1 - 1, H - 40);
        ctx.strokeStyle = ls.color;
        ctx.lineWidth   = 2;
        ctx.globalAlpha = 0.40;
        ctx.strokeRect(hx1 + 1, 20, hx2 - hx1 - 2, H - 40);
        ctx.globalAlpha = 1;
      }
      // Large note name ghost on guitar body
      ctx.globalAlpha = 0.22;
      ctx.shadowColor = ls.color;
      ctx.shadowBlur  = 40;
      ctx.fillStyle   = ls.color;
      ctx.font        = 'bold 80px "Inter", sans-serif';
      ctx.textAlign   = 'center';
      ctx.fillText(ls.name, (FRET_X2 + STRUM_X) / 2, H / 2 + 28);
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    // ── Strings ──
    for (let i = 0; i < 6; i++) {
      const sy      = STR_Y0 + i * STR_SPACING;
      const vib     = vibs[i];
      const s       = strings[i];
      const t       = times[i];
      const startX  = capo > 0 && capo < FRET_POS.length ? fretWireX(capo) : FRET_X1;
      const L       = STR_END - startX; // full playable length

      // Note label (left of nut)
      ctx.font      = 'bold 13px "Inter", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = vib > 0.04 ? s.color : '#6a6a8a';
      ctx.shadowBlur  = vib > 0.04 ? 10 : 0;
      ctx.shadowColor = s.color;
      ctx.fillText(s.name, FRET_X1 - 10, sy + 5);
      ctx.shadowBlur = 0;

      if (vib > 0.015) {
        const amp       = vib * (6 - i * 0.5);   // max ~6px en E4, ~3.5px en E2
        const freq_mult = 3 + (5 - i) * 0.6;    // más ciclos = cuerda más tirante

        // Glow pass
        ctx.lineWidth   = s.thickness + 3;
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = vib * 0.15;
        ctx.shadowColor = s.color;
        ctx.shadowBlur  = 18;
        ctx.beginPath(); ctx.moveTo(startX, sy);
        for (let x = startX; x <= STR_END; x += 4) {
          const xn = (x - startX) / L;
          ctx.lineTo(x, sy + Math.sin(xn * Math.PI) * amp * Math.sin(xn * freq_mult * Math.PI * 2 + t));
        }
        ctx.stroke();

        // Core string
        ctx.lineWidth   = s.thickness;
        ctx.globalAlpha = 0.5 + vib * 0.5;
        ctx.shadowBlur  = 8 + vib * 12;
        ctx.beginPath(); ctx.moveTo(startX, sy);
        for (let x = startX; x <= STR_END; x += 2) {
          const xn = (x - startX) / L;
          ctx.lineTo(x, sy + Math.sin(xn * Math.PI) * amp * Math.sin(xn * freq_mult * Math.PI * 2 + t));
        }
        ctx.stroke();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;

      } else {
        // Static metallic string (full length)
        ctx.lineWidth = s.thickness;
        const metalGrad = ctx.createLinearGradient(0, sy - s.thickness, 0, sy + s.thickness);
        metalGrad.addColorStop(0,   'rgba(200,180,120,0.5)');
        metalGrad.addColorStop(0.5, 'rgba(240,220,160,0.7)');
        metalGrad.addColorStop(1,   'rgba(180,160,100,0.4)');
        ctx.strokeStyle = metalGrad;
        ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.moveTo(FRET_X1, sy); ctx.lineTo(STR_END, sy);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Muted portion behind capo
      if (capo > 0 && capo < FRET_POS.length) {
        ctx.lineWidth   = s.thickness;
        ctx.strokeStyle = 'rgba(100,80,60,0.22)';
        ctx.beginPath(); ctx.moveTo(FRET_X1, sy); ctx.lineTo(fretWireX(capo), sy); ctx.stroke();
      }
    }

    // ── Strum zone indicator (idle, no animation) ──
    // Subtle vertical marker at STRUM_X
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth   = 18;
    ctx.beginPath();
    ctx.moveTo(STRUM_X, STR_Y0 - 10);
    ctx.lineTo(STRUM_X, STR_Y0 + STR_SPACING * 5 + 10);
    ctx.stroke();

    // ── Strum animations ──
    for (let i = 0; i < 6; i++) {
      const age = sages[i];
      if (age < 0) continue;
      const sy = STR_Y0 + i * STR_SPACING;
      const s  = strings[i];
      const p  = age / 55; // 0→1

      // Phase 1 (0-0.35): Pick strike — bright flash + pick sweep lines
      if (p < 0.35) {
        const pp = p / 0.35;
        // Bright hit point
        ctx.shadowColor = s.color;
        ctx.shadowBlur  = 30 * (1 - pp);
        ctx.fillStyle   = s.color;
        ctx.globalAlpha = 1 - pp;
        ctx.beginPath();
        ctx.arc(STRUM_X, sy, 9 * (1 - pp * 0.4), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Pick shape: small angled teardrop moving down
        const pickOffY = pp * 16;
        const pickW = 8, pickH = 18;
        ctx.save();
        ctx.translate(STRUM_X + 14, sy - pickH * 0.4 + pickOffY);
        ctx.rotate(0.3);
        ctx.globalAlpha = 0.85 * (1 - pp);
        ctx.fillStyle = '#e8d070';
        ctx.shadowColor = '#ffe080';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, -pickH / 2);
        ctx.bezierCurveTo(pickW, -pickH / 2, pickW, pickH * 0.2, 0, pickH / 2);
        ctx.bezierCurveTo(-pickW, pickH * 0.2, -pickW, -pickH / 2, 0, -pickH / 2);
        ctx.fill();
        ctx.restore();
        ctx.shadowBlur = 0;

        // Spark lines radiating from contact point
        const numSparks = 6;
        ctx.lineWidth   = 1.5;
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = 0.65 * (1 - pp);
        for (let k = 0; k < numSparks; k++) {
          const angle  = (k / numSparks) * Math.PI * 2 + 0.3;
          const sparkL = 8 + pp * 20;
          ctx.shadowColor = s.color;
          ctx.shadowBlur  = 6;
          ctx.beginPath();
          ctx.moveTo(STRUM_X, sy);
          ctx.lineTo(STRUM_X + Math.cos(angle) * sparkL, sy + Math.sin(angle) * sparkL);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }

      // Phase 2 (0.1-0.9): Expanding elliptical ripple
      if (p > 0.08 && p < 0.90) {
        const pp = (p - 0.08) / 0.82;
        const rx = 6 + pp * 50;
        const ry = 3 + pp * 16;
        ctx.globalAlpha = 0.55 * (1 - pp);
        ctx.strokeStyle = s.color;
        ctx.shadowColor = s.color;
        ctx.shadowBlur  = 10;
        ctx.lineWidth   = 2 * (1 - pp * 0.6);
        ctx.beginPath();
        ctx.ellipse(STRUM_X, sy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Second ring slightly behind
        if (pp > 0.15) {
          const pp2 = pp - 0.15;
          const rx2 = 6 + pp2 * 50, ry2 = 3 + pp2 * 16;
          ctx.globalAlpha = 0.30 * (1 - pp2);
          ctx.lineWidth   = 1.5;
          ctx.beginPath();
          ctx.ellipse(STRUM_X, sy, rx2, ry2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    // ── Finger pressing the string ──
    // Actualiza la última cuerda/traste conocidos cuando hay detección activa
    if (activeStr !== null && detectedFreq !== null) {
      lastStrRef.current  = activeStr;
      lastFretRef.current = Math.max(0, Math.min(12, calcPhysicalFret(detectedFreq, strings[activeStr].freq)));
    }

    // Muestra el dedo mientras la cuerda siga vibrando (aunque ya no se detecte pitch)
    const fingerStr  = lastStrRef.current;
    const fingerFret = lastFretRef.current;
    const fingerVib  = fingerStr !== null ? vibs[fingerStr] : 0;

    if (fingerStr !== null && fingerVib > 0.03) {
      const s        = strings[fingerStr];
      const physFret = fingerFret;
      const fx       = fingerDotX(physFret);
      const sy       = STR_Y0 + fingerStr * STR_SPACING;
      // El dedo se desvanece gradualmente al apagarse la nota
      const fingerAlpha = Math.min(1, fingerVib / 0.25);
      const pulse    = 1 + fingerVib * 0.12;

      if (physFret === 0) {
        // Open string — small circle above the nut con "O"
        ctx.strokeStyle = s.color;
        ctx.lineWidth   = 2.5;
        ctx.globalAlpha = 0.85 * fingerAlpha;
        ctx.shadowColor = s.color;
        ctx.shadowBlur  = 14;
        ctx.beginPath();
        ctx.arc(fx, sy - 22, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        ctx.font      = 'bold 10px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = s.color;
        ctx.fillText('O', fx, sy - 18);

      } else {
        // ── Pressed fret: draw a realistic finger ──
        const fw = 22;   // finger width
        const fh = 34;   // finger height
        // finger is centered vertically on the string
        const fcy = sy;

        ctx.save();
        ctx.translate(fx, fcy);
        ctx.scale(pulse, pulse);

        // String indent under the finger — V-dip to suggest downward press
        // (drawn before the finger so it appears behind)
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth   = s.thickness + 1;
        ctx.beginPath();
        ctx.moveTo(-fw / 2 - 4, 0);
        ctx.quadraticCurveTo(0, 5, fw / 2 + 4, 0);
        ctx.stroke();

        // Drop shadow (finger pressing into fretboard)
        ctx.shadowColor   = 'rgba(0,0,0,0.65)';
        ctx.shadowBlur    = 10;
        ctx.shadowOffsetY = 5;
        ctx.shadowOffsetX = 2;

        // Finger body — skin-tone radial gradient
        const skinGrad = ctx.createRadialGradient(-fw * 0.25, -fh * 0.28, fw * 0.08,
                                                    0, 0, fh * 0.65);
        skinGrad.addColorStop(0,    '#f8d0a0');  // bright highlight
        skinGrad.addColorStop(0.35, '#e8a868');  // mid skin
        skinGrad.addColorStop(0.70, '#c07838');  // shadow side
        skinGrad.addColorStop(1,    '#7a4010');  // deep shadow (pressing edge)
        ctx.fillStyle   = skinGrad;
        ctx.globalAlpha = 0.97 * fingerAlpha;
        ctx.beginPath();
        ctx.ellipse(0, 0, fw / 2, fh / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.shadowOffsetX = 0;

        // Fingernail — lighter semi-transparent arc at top of finger
        ctx.fillStyle   = 'rgba(255,240,215,0.50)';
        ctx.beginPath();
        ctx.ellipse(0, -fh / 2 + fh * 0.28, fw / 2 - 2, fh * 0.22, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        // Nail highlight edge
        ctx.strokeStyle = 'rgba(255,255,240,0.30)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.ellipse(0, -fh / 2 + fh * 0.28, fw / 2 - 3, fh * 0.20, 0, Math.PI, Math.PI * 2);
        ctx.stroke();

        // Knuckle wrinkle lines (subtle horizontal arcs)
        ctx.strokeStyle = 'rgba(150,80,20,0.22)';
        ctx.lineWidth   = 1;
        for (const wy of [2, 9, 14]) {
          ctx.beginPath();
          ctx.ellipse(0, wy, fw / 2 - 5, 3, 0, 0, Math.PI);
          ctx.stroke();
        }

        // Specular highlight — bright spot upper-left
        ctx.fillStyle = 'rgba(255,255,255,0.30)';
        ctx.beginPath();
        ctx.ellipse(-fw * 0.22, -fh * 0.20, fw * 0.18, fh * 0.16, -0.5, 0, Math.PI * 2);
        ctx.fill();

        // String-color glow ring
        ctx.strokeStyle = s.color;
        ctx.lineWidth   = 1.8;
        ctx.globalAlpha = 0.55 * fingerAlpha;
        ctx.shadowColor = s.color;
        ctx.shadowBlur  = 14;
        ctx.beginPath();
        ctx.ellipse(0, 0, fw / 2 + 3, fh / 2 + 3, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;

        // Fret number below the finger
        ctx.font        = 'bold 11px "Inter", sans-serif';
        ctx.textAlign   = 'center';
        ctx.fillStyle   = s.color;
        ctx.shadowColor = s.color;
        ctx.shadowBlur  = 10;
        ctx.globalAlpha = fingerAlpha;
        ctx.fillText(String(physFret), fx, sy + fh / 2 * pulse + 14);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
    }

    // ── Strum zone "RAS" label ──
    ctx.font      = '10px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,220,100,0.25)';
    ctx.fillText('RASGUEO', STRUM_X, H - 8);

    // ── Learning mode: speed badge (top-left) ──
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

    // ── Note info (bottom-right) ──
    if (activeStr !== null && detectedFreq !== null) {
      const s     = strings[activeStr];
      const fret  = Math.max(0, Math.min(12, calcPhysicalFret(detectedFreq, s.freq)));
      const label = `${s.name}  traste ${fret === 0 ? 'al aire' : fret}  ·  ${Math.round(detectedFreq)} Hz`;
      ctx.font        = 'bold 14px "Inter", sans-serif';
      ctx.textAlign   = 'right';
      ctx.shadowColor = s.color;
      ctx.shadowBlur  = 18;
      ctx.fillStyle   = s.color;
      ctx.fillText(label, W - 14, H - 10);
      ctx.shadowBlur  = 0;
      if (label !== lastNoteRef.current) {
        lastNoteRef.current = label;
        setDetectedNote(label);
      }
    } else if (activeStr === null && lastNoteRef.current !== '') {
      lastNoteRef.current = '';
      setDetectedNote('');
    }

    animRef.current = requestAnimationFrame(drawFrame);
  }, []);

  useEffect(() => {
    animRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(animRef.current);
  }, [drawFrame]);

  useEffect(() => { modeRef.current    = mode;     }, [mode]);
  useEffect(() => { capoFretRef.current = capoFret; }, [capoFret]);
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
    vibrationsRef.current = [0, 0, 0, 0, 0, 0];
    strumAgesRef.current  = [-1, -1, -1, -1, -1, -1];
    prevActiveRef.current = null;
    lastStrRef.current    = null;
    lastFretRef.current   = 0;
    cachedStrRef.current  = null;
    cachedFreqRef.current = null;
    frameCountRef.current = 0;
    setRunning(false);
    setRecording(false);
    setDetectedNote('');
    lastNoteRef.current = '';
    // keep fileReady so user can play again without re-selecting
  }

  function buildAudioGraph(actx: AudioContext) {
    const analyser = actx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.5;
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
    const actx    = new AudioContext();
    audioCtxRef.current = actx;
    const analyser = buildAudioGraph(actx);
    const decoded = await actx.decodeAudioData(await file.arrayBuffer());
    const src     = actx.createBufferSource();
    src.buffer    = decoded;
    src.playbackRate.value = speedRef.current;
    src.connect(analyser);
    src.onended   = () => setRunning(false);
    src.start();
    sourceRef.current = src;
    setRunning(true);
  }

  async function startMic() {
    stopAudio();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    micStreamRef.current = stream;
    const actx    = new AudioContext();
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

    const canvasStream = canvas.captureStream(30);
    const combined = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDestRef.current.stream.getAudioTracks(),
    ]);

    const mimeType =
      MediaRecorder.isTypeSupported('video/mp4;codecs=h264,aac')  ? 'video/mp4;codecs=h264,aac'  :
      MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a') ? 'video/mp4;codecs=avc1,mp4a' :
      MediaRecorder.isTypeSupported('video/mp4')                  ? 'video/mp4'                  :
      MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' :
      'video/webm';

    const native = mimeType.startsWith('video/mp4');
    setIsNativeMp4(native);

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
    // Start audio first if file is loaded but not yet playing
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
    a.href = blobUrl;
    a.download = isNativeMp4 ? 'guitarra.mp4' : 'guitarra.webm';
    a.click();
  }

  async function downloadMp4() {
    if (!blobUrl || convertingMp4) return;
    setConvertingMp4(true);
    try {
      const blob = await fetch(blobUrl).then(r => r.blob());
      const form = new FormData();
      form.append('video', blob, isNativeMp4 ? 'guitarra.mp4' : 'guitarra.webm');
      const res  = await fetch('/api/convert-to-mp4', { method: 'POST', body: form });
      if (!res.ok) { alert('Error al convertir a MP4'); return; }
      const mp4Blob = await res.blob();
      const url     = URL.createObjectURL(mp4Blob);
      const a       = document.createElement('a');
      a.href = url; a.download = 'guitarra.mp4'; a.click();
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
          🎸 Visualizador de Cuerdas
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
          Sube un audio o usa el micrófono — ve las cuerdas vibrar, el dedo y el rasgueo en tiempo real
        </p>

        {/* Row 1: instrumento + audio */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' }}>
          <button className={`kk-mode-btn${mode === 'guitarra' ? ' active' : ''}`}
            onClick={() => setMode('guitarra')}>🎸 Guitarra</button>
          <button className={`kk-mode-btn${mode === 'requinto' ? ' active' : ''}`}
            onClick={() => setMode('requinto')}>🎸 Requinto</button>

          <span style={{ width: 1, height: 26, background: 'var(--border)', display: 'inline-block' }} />

          {/* Archivo */}
          <button className={`kk-mode-btn${fileReady && inputType === 'file' ? ' active' : ''}`}
            onClick={() => document.getElementById('gtr-audio-in')?.click()}>
            🎵 {audioName || 'Subir audio'}
          </button>
          <input id="gtr-audio-in" type="file" accept="audio/*"
            style={{ display: 'none' }} onChange={onFileChange} />

          {/* Micrófono */}
          <button
            className={`kk-mode-btn${inputType === 'mic' && running ? ' active' : ''}`}
            style={inputType === 'mic' && running ? { borderColor: 'var(--success)', color: 'var(--success)' } : {}}
            onClick={inputType === 'mic' && running ? stopAudio : () => { setInputType('mic'); setFileReady(false); startMic(); }}>
            {inputType === 'mic' && running ? '⏹ Detener mic' : '🎙 Micrófono en vivo'}
          </button>

          <span style={{ width: 1, height: 26, background: 'var(--border)', display: 'inline-block' }} />

          {/* Tocar / Detener (solo modo archivo) */}
          {inputType === 'file' && fileReady && !running && (
            <button className="kk-btn primary" onClick={playFile}>▶ Tocar</button>
          )}
          {inputType === 'file' && running && (
            <button className="kk-btn" style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
              onClick={stopAudio}>⏹ Detener</button>
          )}
        </div>

        {/* Row 2: capotraste */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>Capotraste:</span>
          {[0, 1, 2, 3, 4, 5, 6, 7].map(n => (
            <button key={n}
              className={`kk-mode-btn${capoFret === n ? ' active' : ''}`}
              style={{ minWidth: 38, padding: '0.3rem 0.5rem', fontSize: '0.82rem' }}
              onClick={() => setCapoFret(n)}>
              {n === 0 ? 'Sin capo' : `T${n}`}
            </button>
          ))}
        </div>

        {/* Row 3: velocidad / modo aprendizaje */}
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
          background: '#080402', borderRadius: 14,
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
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
              color: '#e05d5d', fontSize: '0.83rem', fontWeight: 600,
            }}>
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
              🎵 {detectedNote}
            </span>
          )}
        </div>

        {/* Leyenda */}
        <div style={{
          marginTop: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap',
          padding: '0.75rem 1rem', background: 'var(--surface)',
          borderRadius: 10, border: '1px solid var(--border)', alignItems: 'center',
        }}>
          {(mode === 'guitarra' ? GUITAR_STRINGS : REQUINTO_STRINGS).map(s => (
            <span key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span style={{ width: 20, height: 3, background: s.color, borderRadius: 2, display: 'inline-block' }} />
              {s.name}
            </span>
          ))}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: 'auto' }}>
            Círculo = dedo en el traste · Destello = rasgueo
          </span>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
