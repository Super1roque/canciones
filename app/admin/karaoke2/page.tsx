'use client';
import { useRef, useState, useEffect, useCallback } from 'react';

type Cue      = { start: number; end: number; text: string };
type Particle = { x: number; y: number; vx: number; vy: number; size: number; alpha: number; hue: number; pulse: number };
type SectionType = 'intro' | 'verse' | 'pre-chorus' | 'chorus' | 'bridge' | 'outro' | 'interlude' | 'other';
type Section  = { id: string; type: SectionType; label: string; startTime: number; endTime: number; image: HTMLImageElement | null; imageName: string };
type LyricLine = { cues: Cue[]; start: number; end: number };

function easeOutExpo(x: number): number {
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
}
function easeInCubic(x: number): number {
  return x * x * x;
}

function parseSRT(txt: string): Cue[] {
  return txt
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
    .split(/\n\n+/)
    .map(b => {
      const ls = b.split('\n');
      if (ls.length < 3) return null;
      if (ls.some(l => /amara/i.test(l))) return null;
      const m = ls[1].match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
      if (!m) return null;
      const ts = (h: string, mi: string, s: string, ms: string) => +h * 3600 + +mi * 60 + +s + +ms / 1000;
      const text = ls.slice(2).join(' ').replace(/<[^>]+>/g, '').trim();
      if (!text || /amara/i.test(text)) return null;
      return { start: ts(m[1], m[2], m[3], m[4]), end: ts(m[5], m[6], m[7], m[8]), text };
    })
    .filter(Boolean) as Cue[];
}

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

let W = 1080, H = 1920;
let FS = 104, LH = FS * 1.30, MG = 80, MAX_W = W - MG * 2;

function applyFormat(f: '9:16' | '16:9') {
  if (f === '16:9') { W = 1920; H = 1080; }
  else               { W = 1080; H = 1920; }
  FS = 104; LH = FS * 1.30; MG = 80; MAX_W = W - MG * 2;
}

const ALIGNS = ['center', 'left', 'right', 'center', 'right', 'left'] as const;

const STOPWORDS_ES = new Set([
  'de','la','el','y','a','en','que','un','una','los','las','del','al',
  'se','le','su','lo','me','mi','te','por','con','no','es','son','fue',
  'era','hay','más','pero','como','si','ya','para','este','esta','ese',
  'esa','tan','o','ni','pues','cuando','donde','aunque','porque','ante',
  'bajo','desde','entre','hasta','hacia','sobre','tras','e','u','yo',
  'tu','él','we','i','the','and','to','of','in','is','was','a',
]);
function getWordFS(word: string): number {
  const w = word.replace(/[^a-záéíóúüñ]/gi, '').toLowerCase();
  if (STOPWORDS_ES.has(w)) return FS * 0.72;
  if (w.length <= 3)        return FS * 0.88;
  if (w.length >= 8)        return FS * 1.16;
  return FS;
}

type WordStyle = {
  glowMult:      number;
  activeColor:   string;
  shadowColor:   string;
  upcomingColor: string;
  upcomingAlpha: number;
};

function getWordStyle(word: string): WordStyle {
  const w = word.replace(/[^a-záéíóúüñ]/gi, '').toLowerCase();
  if (STOPWORDS_ES.has(w)) return {
    glowMult: 0.28, activeColor: '#b0b0b0', shadowColor: '#806000',
    upcomingColor: '#38bdf8', upcomingAlpha: 0.75,
  };
  if (w.length >= 7) return {
    glowMult: 1.70, activeColor: '#ffffff', shadowColor: '#facc15',
    upcomingColor: '#ff6d00', upcomingAlpha: 1.0,
  };
  return {
    glowMult: 1.0, activeColor: '#ffffff', shadowColor: '#facc15',
    upcomingColor: '#ff8c00', upcomingAlpha: 0.82,
  };
}

function applyGlitch(ctx: CanvasRenderingContext2D, snap: HTMLCanvasElement, g: number) {
  const numRows = Math.ceil(g * 50);
  const imgData = ctx.getImageData(0, 0, W, H);
  const data    = imgData.data;
  for (let i = 0; i < numRows; i++) {
    const y     = Math.floor(Math.random() * H);
    const shift = Math.round((Math.random() * 2 - 1) * g * 250);
    if (Math.abs(shift) < 3) continue;
    const base = y * W * 4;
    const row  = Uint8Array.from(data.subarray(base, base + W * 4));
    if (shift > 0) {
      for (let x = W - 1; x >= shift; x--) {
        const d = base + x * 4, s = (x - shift) * 4;
        data[d] = row[s]; data[d+1] = row[s+1]; data[d+2] = row[s+2]; data[d+3] = row[s+3];
      }
    } else {
      const a = -shift;
      for (let x = 0; x < W - a; x++) {
        const d = base + x * 4, s = (x + a) * 4;
        data[d] = row[s]; data[d+1] = row[s+1]; data[d+2] = row[s+2]; data[d+3] = row[s+3];
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const caShift = Math.round(g * 20);
  if (caShift >= 2) {
    ctx.save();
    ctx.globalAlpha = 0.30 * g;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(snap, -caShift, 0);
    ctx.drawImage(snap,  caShift, 0);
    ctx.restore();
  }
  if (g > 0.22) {
    const noiseN = Math.floor(g * 350);
    ctx.save();
    for (let i = 0; i < noiseN; i++) {
      ctx.globalAlpha = Math.random() * 0.85;
      ctx.fillStyle   = `hsl(${Math.random() * 360},100%,65%)`;
      ctx.fillRect(Math.random() * W, Math.random() * H, Math.random() * 7 + 1, Math.random() * 4 + 1);
    }
    ctx.restore();
  }
  if (g > 0.40 && Math.random() < 0.45) {
    const ty = Math.floor(Math.random() * H);
    const th = Math.floor(12 + Math.random() * 100);
    const tx = Math.round((Math.random() * 2 - 1) * g * 140);
    ctx.drawImage(snap, 0, ty, W, th, tx, ty, W, th);
  }
}

function applyGlitch2(ctx: CanvasRenderingContext2D, _snap: HTMLCanvasElement, g: number) {
  const imgData = ctx.getImageData(0, 0, W, H);
  const data    = imgData.data;
  const sortRows = Math.ceil(g * 60);
  const thresh   = 75 + (1 - g) * 95;
  for (let i = 0; i < sortRows; i++) {
    const y    = Math.floor(Math.random() * H);
    const base = y * W * 4;
    const px: { r: number; gr: number; b: number; a: number; lum: number }[] = [];
    for (let x = 0; x < W; x++) {
      const o = base + x * 4;
      const r = data[o], gr = data[o+1], b = data[o+2], a = data[o+3];
      px.push({ r, gr, b, a, lum: 0.299*r + 0.587*gr + 0.114*b });
    }
    let start = -1;
    for (let x = 0; x <= W; x++) {
      const inSeg = x < W && px[x].lum > thresh;
      if (inSeg && start < 0) start = x;
      if (!inSeg && start >= 0) {
        const len = x - start;
        if (len > 4) {
          const seg = px.slice(start, x).sort((a, b) => a.lum - b.lum);
          for (let j = 0; j < seg.length; j++) {
            const o = base + (start + j) * 4;
            data[o] = seg[j].r; data[o+1] = seg[j].gr;
            data[o+2] = seg[j].b; data[o+3] = seg[j].a;
          }
        }
        start = -1;
      }
    }
  }
  const warpRows = Math.ceil(g * 80);
  const amp      = g * 140;
  for (let i = 0; i < warpRows; i++) {
    const y     = Math.floor(Math.random() * H);
    const shift = Math.round(Math.sin(y * 0.03) * amp);
    if (Math.abs(shift) < 2) continue;
    const base = y * W * 4;
    const row  = Uint8Array.from(data.subarray(base, base + W * 4));
    if (shift > 0) {
      for (let x = W - 1; x >= shift; x--) {
        const d = base + x * 4, s = (x - shift) * 4;
        data[d] = row[s]; data[d+1] = row[s+1]; data[d+2] = row[s+2]; data[d+3] = row[s+3];
      }
    } else {
      const a = -shift;
      for (let x = 0; x < W - a; x++) {
        const d = base + x * 4, s = (x + a) * 4;
        data[d] = row[s]; data[d+1] = row[s+1]; data[d+2] = row[s+2]; data[d+3] = row[s+3];
      }
    }
  }
  const strips = Math.ceil(g * 7);
  for (let i = 0; i < strips; i++) {
    const sy = Math.floor(Math.random() * H);
    const sh = Math.floor(2 + Math.random() * Math.max(3, 28 * g));
    for (let row = sy; row < Math.min(H, sy + sh); row++) {
      for (let x = 0; x < W; x++) {
        const o = (row * W + x) * 4;
        data[o]   = 255 - data[o];
        data[o+1] = 255 - data[o+1];
        data[o+2] = 255 - data[o+2];
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const lines = Math.ceil(g * 6);
  ctx.save();
  for (let i = 0; i < lines; i++) {
    const ty = Math.floor(Math.random() * H);
    const th = Math.floor(1 + Math.random() * 7);
    ctx.globalAlpha = 0.5 + Math.random() * 0.5;
    ctx.fillStyle   = Math.random() < 0.55 ? '#ffffff' : `hsl(${120 + Math.random()*60}, 100%, 70%)`;
    ctx.fillRect(0, ty, W, th);
  }
  ctx.restore();
}

type CueLayout = { cue: Cue; x: number; y: number; ww: number; fs: number };

function computeCueLayout(ctx: CanvasRenderingContext2D, cues: Cue[]): CueLayout[] {
  (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '3px';
  const result: CueLayout[] = [];
  let line: { cue: Cue; ww: number; fs: number }[] = [];
  let lineW = 0, y = 0, li = 0;
  const flush = () => {
    if (!line.length) return;
    const al = ALIGNS[li % ALIGNS.length];
    const lw = line.reduce((s, it) => s + it.ww, 0);
    let wx = al === 'center' ? W / 2 - lw / 2 : al === 'left' ? MG : W - MG - lw;
    for (const { cue, ww, fs } of line) { result.push({ cue, x: wx, y, ww, fs }); wx += ww; }
    y += LH; li++; line = []; lineW = 0;
  };
  for (const cue of cues) {
    const fs = getWordFS(cue.text);
    ctx.font  = `900 ${fs}px "Bebas Neue"`;
    const ww  = ctx.measureText(cue.text + ' ').width;
    if (lineW + ww > MAX_W && line.length) flush();
    line.push({ cue, ww, fs }); lineW += ww;
  }
  flush();
  return result;
}

// Color accent per section type
const SECTION_COLORS: Record<SectionType, string> = {
  intro:        '#38bdf8',
  verse:        '#4ade80',
  'pre-chorus': '#facc15',
  chorus:       '#f97316',
  bridge:       '#a855f7',
  outro:        '#f87171',
  interlude:    '#2dd4bf',
  other:        '#94a3b8',
};

export default function Karaoke2Page() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const audRef       = useRef<HTMLAudioElement>(null);
  const animRef      = useRef<number>(0);
  const recRef       = useRef<MediaRecorder | null>(null);
  const chunksRef    = useRef<BlobPart[]>([]);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const videoBlobUrlRef   = useRef<string>('');
  const audioBlobUrlRef   = useRef<string>('');
  const bgBlobUrlRef      = useRef<string>('');
  const transparentRecRef = useRef(false);

  const particlesRef   = useRef<Particle[]>([]);
  const cueLayoutRef   = useRef<CueLayout[]>([]);
  const lyricLinesRef  = useRef<LyricLine[]>([]);
  const scrollYRef     = useRef(0);
  const scrollVelRef   = useRef(0);
  const [displayMode, setDisplayMode] = useState<'scroll' | 'page'>('scroll');
  const [format, setFormat]           = useState<'9:16' | '16:9'>('9:16');
  const [canvasDims, setCanvasDims]   = useState({ w: 1080, h: 1920 });
  const displayModeRef = useRef<'scroll' | 'page'>('scroll');

  const [cues, setCues]           = useState<Cue[]>([]);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [srtLoaded, setSrtLoaded] = useState(false);
  const [srtName, setSrtName]     = useState('');
  const [audioName, setAudioName] = useState('');
  const [playing, setPlaying]     = useState(false);
  const [recording, setRecording]         = useState(false);
  const [blobUrl, setBlobUrl]             = useState<string | null>(null);
  const [convertingMp4, setConvertingMp4] = useState(false);
  const [isTransparentRec, setIsTransparentRec] = useState(false);
  const [isNativeMp4, setIsNativeMp4]   = useState(false);
  const [progress, setProgress]   = useState(0);
  const [timeLabel, setTimeLabel] = useState('0:00 / 0:00');
  const [activeCue, setActiveCue] = useState(-1);
  const cueListRef = useRef<HTMLDivElement>(null);
  const [bgImage, setBgImage]     = useState<HTMLImageElement | null>(null);
  const [bgName, setBgName]       = useState('');
  const bgImageRef   = useRef<HTMLImageElement | null>(null);
  const audioFileRef = useRef<File | null>(null);

  // ── Glitch ────────────────────────────────────────────────────────────
  const analyserRef      = useRef<AnalyserNode | null>(null);
  const freqDataRef      = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const glitchRef        = useRef(0);
  const glitchEnabledRef = useRef(true);
  const offCanvasRef     = useRef<HTMLCanvasElement | null>(null);
  const [glitchEnabled, setGlitchEnabled] = useState(true);
  const [glitchStyle, setGlitchStyle]     = useState<'digital' | 'analog'>('digital');
  const glitchStyleRef = useRef<'digital' | 'analog'>('digital');

  // ── Transcripción IA ──────────────────────────────────────────────────
  const [transcribing, setTranscribing]           = useState(false);
  const [transcribeError, setTranscribeError]     = useState('');

  // ── Tap-sync ──────────────────────────────────────────────────────────
  const [inputMode, setInputMode]   = useState<'srt' | 'tap' | 'ai'>('ai');
  const [lyricsText, setLyricsText] = useState('');
  const [tapLines, setTapLines]     = useState<string[]>([]);
  const [tapping, setTapping]           = useState(false);
  const [tapIdx, setTapIdx]             = useState(0);
  const [tapLineStatus, setTapLineStatus] = useState<'waiting' | 'started' | 'ended'>('waiting');
  const tappingRef       = useRef(false);
  const tapIdxRef        = useRef(0);
  const tapTimestampsRef = useRef<number[]>([]);
  const tapEndsRef       = useRef<(number | null)[]>([]);
  const tapLinesRef      = useRef<string[]>([]);

  // ── Secciones ─────────────────────────────────────────────────────────
  const sectionsRef          = useRef<Section[]>([]);
  const sectionTransRef      = useRef<{ label: string; time: number; color: string } | null>(null);
  const prevSectionIdxRef    = useRef(-1);
  const [sections, setSections]           = useState<Section[]>([]);
  const [detectingSection, setDetectingSection] = useState(false);
  const [detectError, setDetectError]     = useState('');
  const [modalSec, setModalSec]           = useState<Section | null>(null);
  const [imgPrompt, setImgPrompt]         = useState('');
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [songStyle, setSongStyle]         = useState('');
  const [styleReason, setStyleReason]     = useState('');
  const [detectingStyle, setDetectingStyle] = useState(false);

  // ── Particles init ────────────────────────────────────────────────────
  useEffect(() => {
    particlesRef.current = Array.from({ length: 90 }, () => ({
      x:     Math.random() * W,
      y:     Math.random() * H,
      vx:    (Math.random() - 0.5) * 0.35,
      vy:    -(Math.random() * 0.45 + 0.12),
      size:  Math.random() * 2.5 + 0.6,
      alpha: Math.random() * 0.45 + 0.08,
      hue:   Math.random() < 0.6 ? Math.random() * 25 + 38 : Math.random() * 40 + 255,
      pulse: Math.random() * Math.PI * 2,
    }));
  }, []);

  // ── Fonts ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const f1 = new FontFace('Bebas Neue', "url('https://fonts.gstatic.com/s/bebasneue/v14/JTUSjIg69CK48gW7PXoo9WdhyyTh89ZNpQ.woff2')");
    const f2 = new FontFace('DM Sans',    "url('https://fonts.gstatic.com/s/dmsans/v14/rP2Hp2ywxg089UriCZOIHQ.woff2')");
    Promise.all([f1.load(), f2.load()]).then(fonts => {
      fonts.forEach(f => document.fonts.add(f));
      if (cueLayoutRef.current.length > 0) {
        const tmp = document.createElement('canvas');
        const tc  = tmp.getContext('2d')!;
        cueLayoutRef.current = computeCueLayout(tc, cuesRef.current);
      }
    });
  }, []);

  // ── Layout recompute ──────────────────────────────────────────────────
  useEffect(() => {
    scrollYRef.current = 0;
    if (cues.length === 0) { cueLayoutRef.current = []; return; }
    const tmp = document.createElement('canvas');
    const tc  = tmp.getContext('2d')!;
    cueLayoutRef.current = computeCueLayout(tc, cues);
  }, [cues]);

  // ── Lyric lines for romantic fill ─────────────────────────────────────
  useEffect(() => {
    if (cues.length === 0) { lyricLinesRef.current = []; return; }
    const lines: LyricLine[] = [];
    let cur: Cue[] = [];
    for (const cue of cues) {
      if (cur.length === 0) {
        cur.push(cue);
      } else {
        const gap = cue.start - cur[cur.length - 1].end;
        if (gap > 0.8 || cur.length >= 3) {
          lines.push({ cues: cur, start: cur[0].start, end: cur[cur.length - 1].end });
          cur = [cue];
        } else {
          cur.push(cue);
        }
      }
    }
    if (cur.length > 0) lines.push({ cues: cur, start: cur[0].start, end: cur[cur.length - 1].end });
    lyricLinesRef.current = lines;
  }, [cues]);

  // ── Format change ─────────────────────────────────────────────────────
  useEffect(() => {
    applyFormat(format);
    setCanvasDims({ w: W, h: H });
    const canvas = canvasRef.current;
    if (canvas) { canvas.width = W; canvas.height = H; }
    if (cuesRef.current.length > 0) {
      const tmp = document.createElement('canvas');
      const tc  = tmp.getContext('2d')!;
      cueLayoutRef.current = computeCueLayout(tc, cuesRef.current);
    }
    offCanvasRef.current = null;
  }, [format]);

  // ── Draw ──────────────────────────────────────────────────────────────
  const drawFrame = useCallback((t: number, cueList: Cue[]) => {
    const canvas = canvasRef.current;
    const aud    = audRef.current;
    if (!canvas || !aud) return;
    const ctxOrNull = canvas.getContext('2d');
    if (!ctxOrNull) return;
    const ctx   = ctxOrNull;
    const ctxLS = ctx as CanvasRenderingContext2D & { letterSpacing: string };

    // ── Background: prefer section image, fallback to global bg ───────
    // Use the start of the active lyric line for section lookup so the
    // background doesn't switch mid-line while words are still being sung.
    const activeBgLine = lyricLinesRef.current.find(l => t >= l.start && t <= l.end);
    const bgT  = activeBgLine ? activeBgLine.start : t;
    const secs = sectionsRef.current;
    const sec  = secs.find(s => bgT >= s.startTime && bgT < s.endTime)
              ?? (secs.length > 0 && bgT >= secs[secs.length - 1].startTime ? secs[secs.length - 1] : null);
    const bgImg  = sec?.image ?? bgImageRef.current;
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, W, H);
    } else if (transparentRecRef.current) {
      ctx.clearRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#FF00FF';
      ctx.fillRect(0, 0, W, H);
    }

    // ── Cue detection ─────────────────────────────────────────────────
    const idx  = cueList.findIndex(c => t >= c.start && t <= c.end);
    const curr = idx >= 0 ? cueList[idx] : null;
    const FLY_DUR = 0.50;

    function drawFlyThrough(wordText: string, cx: number, cy: number, age: number, fs: number) {
      const p     = age / FLY_DUR;
      const ep    = easeInCubic(p);
      const sc    = 1 + ep * 1.9;
      const alpha = 1 - p;
      if (alpha < 0.01) return;
      ctx.save();
      ctx.globalAlpha  = alpha;
      ctx.translate(cx, cy);
      ctx.scale(sc, sc);
      ctx.textAlign    = 'center';
      ctx.font         = `900 ${fs}px "Bebas Neue"`;
      ctx.strokeStyle  = 'rgba(0,0,0,0.85)';
      ctx.lineJoin     = 'round';
      ctx.lineWidth    = fs * 0.04;
      ctx.shadowColor  = '#facc15';
      ctx.shadowBlur   = (1 - p) * 22;
      ctx.fillStyle    = '#ffffff';
      ctx.strokeText(wordText, 0, 0);
      ctx.fillText(wordText, 0, 0);
      ctx.shadowBlur   = 0;
      ctx.restore();
    }

    // ── Romantic fill display ─────────────────────────────────────────────
    const drawFilledLine = (line: LyricLine, cy: number, fontSize: number, fillT: number | null) => {
      ctx.font = `900 ${fontSize}px "Bebas Neue"`;
      const spW   = ctx.measureText(' ').width;
      const rawWW = line.cues.map(c => ctx.measureText(c.text).width + spW);
      const rawTW = rawWW.reduce((s, w) => s + w, 0) - spW;
      const fs    = rawTW > W * 0.88 ? fontSize * (W * 0.88 / rawTW) : fontSize;
      ctx.font    = `900 ${fs}px "Bebas Neue"`;
      const sp    = ctx.measureText(' ').width;
      const wws   = line.cues.map(c => ctx.measureText(c.text).width + sp);
      const totW  = wws.reduce((s, w) => s + w, 0) - sp;
      const startX = W / 2 - totW / 2;

      // Outline negro para todo el texto
      ctx.save();
      ctx.textAlign   = 'left';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth   = fs * 0.09;
      ctx.lineJoin    = 'round';
      ctx.globalAlpha = 0.88;
      let ox = startX;
      for (let i = 0; i < line.cues.length; i++) {
        ctx.strokeText(line.cues[i].text, ox, cy);
        ox += wws[i];
      }
      ctx.restore();

      // Base: all words white @ low alpha
      ctx.save();
      ctx.textAlign   = 'left';
      ctx.globalAlpha = 0.42;
      ctx.fillStyle   = '#ffffff';
      let bx = startX;
      for (let i = 0; i < line.cues.length; i++) {
        ctx.fillText(line.cues[i].text, bx, cy);
        bx += wws[i];
      }
      ctx.restore();

      // Fill: pink→orange→gold gradient, clipped left-to-right
      if (fillT !== null) {
        let fillW = 0;
        for (let i = 0; i < line.cues.length; i++) {
          const c = line.cues[i];
          if (fillT >= c.end)        { fillW += wws[i]; }
          else if (fillT >= c.start) { fillW += wws[i] * ((fillT - c.start) / Math.max(0.001, c.end - c.start)); break; }
          else                        { break; }
        }
        if (fillW > 1) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(startX - 2, cy - fs * 1.0, fillW + 4, fs * 1.20);
          ctx.clip();
          const grad = ctx.createLinearGradient(startX, cy, startX + totW, cy);
          grad.addColorStop(0,   '#ff6eb4');
          grad.addColorStop(0.5, '#ff9a4d');
          grad.addColorStop(1,   '#facc15');
          ctx.textAlign   = 'left';
          ctx.globalAlpha = 1.0;
          ctx.fillStyle   = grad;
          ctx.shadowColor = 'rgba(255,110,180,0.55)';
          ctx.shadowBlur  = fs * 0.20;
          let fx = startX;
          for (let i = 0; i < line.cues.length; i++) {
            ctx.fillText(line.cues[i].text, fx, cy);
            fx += wws[i];
          }
          ctx.restore();
        }
      }
    };

    // Section-filtered lyric lines
    let allLines = lyricLinesRef.current;
    if (sectionsRef.current.length > 0) {
      const curSec = sectionsRef.current.find(s => t >= s.startTime && t < s.endTime);
      if (curSec) allLines = allLines.filter(l => l.start >= curSec.startTime && l.start < curSec.endTime);
    }

    if (allLines.length > 0) {
      const activeIdx = allLines.findIndex(l => t >= l.start && t <= l.end);
      let dispIdx  = allLines.length - 1;
      let fillT: number | null = null;
      if (activeIdx >= 0) {
        dispIdx = activeIdx; fillT = t;
      } else {
        const nextIdx = allLines.findIndex(l => l.start > t);
        if (nextIdx >= 0) { dispIdx = nextIdx; }
        else { fillT = allLines[allLines.length - 1].end; }
      }

      const curLine  = allLines[dispIdx];
      const nextLine = dispIdx + 1 < allLines.length ? allLines[dispIdx + 1] : null;
      const mainFS   = H * 0.055;
      const nextFS   = H * 0.038;
      const curY     = H * 0.72;
      const nxtY     = H * 0.85;

      drawFilledLine(curLine,  curY, mainFS, fillT);
      if (nextLine) drawFilledLine(nextLine, nxtY, nextFS, null);

      // Line progress bar
      if (fillT !== null) {
        const lineDur  = Math.max(curLine.end - curLine.start, 0.01);
        const lineProg = Math.min(1, (fillT - curLine.start) / lineDur);
        const barW = W * 0.65;
        const barX = W / 2 - barW / 2;
        const barY = H * 0.79;
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.beginPath(); ctx.roundRect(barX, barY, barW, 4, 2); ctx.fill();
        if (lineProg > 0) {
          const bg = ctx.createLinearGradient(barX, 0, barX + barW, 0);
          bg.addColorStop(0, '#ff6eb4'); bg.addColorStop(0.5, '#ff9a4d'); bg.addColorStop(1, '#facc15');
          ctx.fillStyle = bg;
          ctx.beginPath(); ctx.roundRect(barX, barY, barW * lineProg, 4, 2); ctx.fill();
        }
      }
    }

    // ── Gap indicator ─────────────────────────────────────────────────
    if (!curr && cueList.length > 0) {
      const nextCue = cueList.find(c => c.start > t);
      if (nextCue) {
        let gapStart = 0;
        for (let i = cueList.length - 1; i >= 0; i--) {
          if (cueList[i].end <= t) { gapStart = cueList[i].end; break; }
        }
        const gapDur = nextCue.start - gapStart;
        if (gapDur > 0.1) {
          const gapProg   = Math.max(0, Math.min(1, (t - gapStart) / gapDur));
          const remaining = Math.max(0, nextCue.start - t);
          const barH = 54, barW = W * 0.76, barX = W / 2 - barW * 0.76 / 2, barY = H * 0.86;
          ctx.fillStyle = '#0d1f0d';
          ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, barH / 2); ctx.fill();
          if (gapProg > 0) {
            const fillW = barW * gapProg;
            const grd   = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
            grd.addColorStop(0, '#1e3a5f'); grd.addColorStop(0.6, '#a855f7'); grd.addColorStop(1, '#facc15');
            ctx.fillStyle = grd;
            ctx.beginPath(); ctx.roundRect(barX, barY, fillW, barH, barH / 2); ctx.fill();
          }
          if (remaining < 0.8 && gapProg > 0) {
            const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 6);
            const dotR  = barH * 0.55 + pulse * 4;
            const dotX  = barX + barW * gapProg;
            ctx.fillStyle = '#facc15'; ctx.shadowColor = '#facc15'; ctx.shadowBlur = 18 + pulse * 10;
            ctx.beginPath(); ctx.arc(dotX, barY + barH / 2, dotR, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
          }
          ctx.font = '400 28px "DM Sans"'; ctx.fillStyle = '#888888';
          ctx.textAlign = 'right'; ctx.fillText(remaining.toFixed(1) + 's', barX - 16, barY + barH * 0.78);
          ctx.textAlign = 'left'; ctx.fillStyle = '#555555';
          ctx.fillText('GAP', barX + barW + 16, barY + barH * 0.78);
        }
      }
    }

    // ── Timeline ──────────────────────────────────────────────────────
    const dur = aud.duration || 1;
    ctx.fillStyle = '#1a4a28';
    ctx.fillRect(0, H - 10, W, 10);
    const tlGrd = ctx.createLinearGradient(0, 0, W, 0);
    tlGrd.addColorStop(0, '#a855f7'); tlGrd.addColorStop(0.5, '#facc15'); tlGrd.addColorStop(1, '#f97316');
    ctx.fillStyle = tlGrd;
    ctx.fillRect(0, H - 10, W * (t / dur), 10);
    ctx.font = '400 32px "DM Sans"'; ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'right';
    ctx.fillText(fmt(t) + ' / ' + fmt(dur), W - 36, 58);

    // ── Glitch ────────────────────────────────────────────────────────
    if (glitchEnabledRef.current) {
      if (analyserRef.current && freqDataRef.current) {
        analyserRef.current.getByteFrequencyData(freqDataRef.current);
        const fd   = freqDataRef.current;
        const kick = (fd[0] + fd[1] + fd[2] + fd[3] + fd[4]) / 5;
        if (kick > 205) glitchRef.current = Math.min(1, glitchRef.current + (kick - 205) / 50 * 0.55);
      }
      const g = glitchRef.current;
      glitchRef.current *= 0.87;
      if (g > 0.04) {
        if (!offCanvasRef.current) {
          const oc = document.createElement('canvas');
          oc.width = W; oc.height = H;
          offCanvasRef.current = oc;
        }
        offCanvasRef.current.getContext('2d')!.drawImage(canvas, 0, 0);
        if (glitchStyleRef.current === 'analog') applyGlitch2(ctx, offCanvasRef.current, g);
        else applyGlitch(ctx, offCanvasRef.current, g);
      }
    }
  }, []);

  // ── Animation loop ────────────────────────────────────────────────────
  const cuesRef = useRef<Cue[]>([]);
  useEffect(() => { cuesRef.current = cues; }, [cues]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      if (recRef.current?.state !== 'inactive') recRef.current?.stop();
      recRef.current = null;
      audioCtxRef.current?.suspend();
      if (videoBlobUrlRef.current) URL.revokeObjectURL(videoBlobUrlRef.current);
      if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current);
      if (bgBlobUrlRef.current)    URL.revokeObjectURL(bgBlobUrlRef.current);
      offCanvasRef.current = null;
      bgImageRef.current   = null;
      chunksRef.current    = [];
      particlesRef.current = [];
      cueLayoutRef.current = [];
    };
  }, []);

  const loop = useCallback(() => {
    const aud = audRef.current;
    if (!aud) return;
    const t   = aud.currentTime;

    // Track section transitions
    const secs    = sectionsRef.current;
    const currSec = secs.findIndex(s => t >= s.startTime && t < s.endTime);
    if (currSec >= 0 && currSec !== prevSectionIdxRef.current) {
      const s = secs[currSec];
      sectionTransRef.current = {
        label: s.label,
        time:  t,
        color: SECTION_COLORS[s.type] ?? '#f97316',
      };
    }
    prevSectionIdxRef.current = currSec;

    drawFrame(t, cuesRef.current);
    const dur = aud.duration || 1;
    setProgress((t / dur) * 100);
    setTimeLabel(fmt(t) + ' / ' + fmt(dur));
    const idx = cuesRef.current.findIndex(c => t >= c.start && t <= c.end);
    setActiveCue(idx);
    animRef.current = requestAnimationFrame(loop);
  }, [drawFrame]);

  useEffect(() => {
    if (!cueListRef.current) return;
    const el = cueListRef.current.querySelector('.kc-active') as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeCue]);

  useEffect(() => {
    if (audioLoaded) {
      drawFrame(audRef.current?.currentTime ?? 0, cuesRef.current);
      animRef.current = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [audioLoaded, srtLoaded, loop, drawFrame]);

  // ── Audio graph ───────────────────────────────────────────────────────
  function ensureAudioGraph() {
    const aud = audRef.current;
    if (!aud) return;
    if (audioCtxRef.current) {
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      return;
    }
    const actx           = new AudioContext();
    audioCtxRef.current  = actx;
    audioDestRef.current = actx.createMediaStreamDestination();
    const analyser       = actx.createAnalyser();
    analyser.fftSize     = 512;
    analyser.smoothingTimeConstant = 0.80;
    analyserRef.current  = analyser;
    freqDataRef.current  = new Uint8Array(analyser.frequencyBinCount);
    const src = actx.createMediaElementSource(aud);
    src.connect(analyser);
    analyser.connect(audioDestRef.current);
    analyser.connect(actx.destination);
  }

  // ── Controls ──────────────────────────────────────────────────────────
  function togglePlay() {
    const aud = audRef.current;
    if (!aud) return;
    if (aud.paused) {
      ensureAudioGraph();
      audioCtxRef.current?.resume();
      aud.play().catch(() => {}); setPlaying(true);
    } else { aud.pause(); setPlaying(false); }
  }

  function triggerGlitch(intensity = 1) { glitchRef.current = Math.min(1, intensity); }

  function seekTo(e: React.MouseEvent<HTMLDivElement>) {
    const aud = audRef.current;
    if (!aud) return;
    const r = e.currentTarget.getBoundingClientRect();
    aud.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (aud.duration || 0);
  }

  // ── Recording ─────────────────────────────────────────────────────────
  async function startRecord(transparent = false) {
    const canvas = canvasRef.current;
    const aud    = audRef.current;
    if (!canvas || !aud) return;
    chunksRef.current = [];
    setBlobUrl(null);
    transparentRecRef.current = transparent;
    const canvasStream = canvas.captureStream(30);
    ensureAudioGraph();
    if (audioCtxRef.current?.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    const audioTracks = audioDestRef.current?.stream.getAudioTracks() ?? [];
    if (audioTracks.length === 0) {
      alert('No se pudo capturar el audio. Presiona Play un momento y vuelve a intentar.');
      return;
    }
    const combined = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);

    // Siempre WebM: garantiza audio+video en todos los browsers.
    // El MP4 final se genera server-side por ffmpeg, que sí preserva el audio.
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';
    const isNat = false;
    const rec = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 5_000_000 });
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      transparentRecRef.current = false;
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      if (videoBlobUrlRef.current) URL.revokeObjectURL(videoBlobUrlRef.current);
      const newUrl = URL.createObjectURL(blob);
      videoBlobUrlRef.current = newUrl;
      setBlobUrl(newUrl);
      setRecording(false);
      setIsNativeMp4(isNat);
      setIsTransparentRec(transparent);
    };
    recRef.current = rec;
    rec.start(200);
    aud.currentTime = 0;
    aud.play().catch(() => {});
    setPlaying(true);
    setRecording(true);
  }

  function stopRecord() {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
    audRef.current?.pause();
    setPlaying(false);
  }
  function toggleRecord()            { if (!recording) startRecord(false); else stopRecord(); }
  function toggleTransparentRecord() { if (!recording) startRecord(true);  else stopRecord(); }
  function startSample() { startRecord(); setTimeout(() => stopRecord(), 30_000); }

  function downloadVideo() {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = isTransparentRec ? 'karaoke2-transparente.webm' : 'karaoke2.webm';
    a.click();
  }

  async function downloadMp4() {
    if (!blobUrl || convertingMp4) return;
    setConvertingMp4(true);
    try {
      const blob = await fetch(blobUrl).then(r => r.blob());
      const form = new FormData();
      form.append('video', blob, isNativeMp4 ? 'karaoke2.mp4' : 'karaoke2.webm');
      const res  = await fetch('/api/convert-to-mp4', { method: 'POST', body: form });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let msg = '';
        try { msg = JSON.parse(text).error ?? ''; } catch { msg = text.slice(0, 200); }
        if (!msg) msg = `HTTP ${res.status}`;
        if (res.status === 413) msg = 'Demasiado grande (límite 4.5 MB). Descarga el .webm y convierte con CapCut.';
        alert('Error al convertir: ' + msg);
        return;
      }
      const mp4Blob = await res.blob();
      const url     = URL.createObjectURL(mp4Blob);
      const a       = document.createElement('a');
      a.href = url; a.download = 'karaoke2.mp4'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Error de conexión. Descarga el .webm e impórtalo en CapCut.');
    } finally {
      setConvertingMp4(false);
    }
  }

  // ── File loaders ──────────────────────────────────────────────────────
  function onSrtChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = ev => {
      const parsed = parseSRT(ev.target?.result as string);
      setCues(parsed); cuesRef.current = parsed;
      setSrtName(f.name); setSrtLoaded(true);
    };
    fr.readAsText(f, 'UTF-8');
  }

  function onBgChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (bgBlobUrlRef.current) URL.revokeObjectURL(bgBlobUrlRef.current);
    const url = URL.createObjectURL(f);
    bgBlobUrlRef.current = url;
    const img = new Image();
    img.onload = () => { bgImageRef.current = img; setBgImage(img); setBgName(f.name); };
    img.src = url;
  }

  function removeBg() { bgImageRef.current = null; setBgImage(null); setBgName(''); }

  function onAudioChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    audioFileRef.current = f;
    const aud = audRef.current;
    if (!aud) return;
    if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current);
    const url = URL.createObjectURL(f);
    audioBlobUrlRef.current = url;
    aud.src = url; aud.load();
    setAudioName(f.name); setAudioLoaded(true);
  }

  // ── Tap-sync ──────────────────────────────────────────────────────────
  function prepareLyrics() {
    const isInstruction = (l: string) => /^\[.*\]$|^\(.*\)$/.test(l);
    const lines = lyricsText.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !isInstruction(l));
    setTapLines(lines); tapLinesRef.current = lines;
  }

  function startTapping() {
    const aud = audRef.current;
    if (!aud) return;
    tapTimestampsRef.current = []; tapEndsRef.current = [];
    tapIdxRef.current = 0; setTapIdx(0); setTapLineStatus('waiting');
    tappingRef.current = true; setTapping(true);
    aud.currentTime = 0; aud.play().catch(() => {}); setPlaying(true);
  }

  function registerTap() {
    const aud = audRef.current;
    if (!aud || !tappingRef.current) return;
    tapTimestampsRef.current.push(aud.currentTime);
    tapEndsRef.current.push(null);
    const newIdx = tapIdxRef.current + 1;
    tapIdxRef.current = newIdx; setTapIdx(newIdx); setTapLineStatus('started');
  }

  function registerEnd() {
    const aud = audRef.current;
    if (!aud || !tappingRef.current) return;
    const lastIdx = tapIdxRef.current - 1;
    if (lastIdx < 0) return;
    tapEndsRef.current[lastIdx] = aud.currentTime;
    setTapLineStatus('ended');
    if (tapIdxRef.current >= tapLinesRef.current.length) finishTapping();
  }

  function finishTapping() {
    const aud = audRef.current;
    tappingRef.current = false; setTapping(false);
    aud?.pause(); setPlaying(false);
    const lines = tapLinesRef.current, ts = tapTimestampsRef.current, ends = tapEndsRef.current;
    const dur   = aud?.duration || 0;
    const built: Cue[] = lines.map((text, i) => ({
      start: ts[i]   ?? 0,
      end:   ends[i] ?? ts[i + 1] ?? (dur > 0 ? dur : (ts[i] ?? 0) + 5),
      text,
    }));
    setCues(built); cuesRef.current = built; setSrtLoaded(true);
  }

  function resetTap() {
    setCues([]); cuesRef.current = [];
    setTapLines([]); tapLinesRef.current = [];
    setTapIdx(0); tapIdxRef.current = 0;
    tapTimestampsRef.current = []; tapEndsRef.current = [];
    tappingRef.current = false; setTapping(false); setSrtLoaded(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!tappingRef.current) return;
      if (e.code === 'Space') { e.preventDefault(); registerTap(); }
      if (e.code === 'Enter') { e.preventDefault(); registerEnd(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Transcripción Deepgram ─────────────────────────────────────────────
  async function transcribeAudio() {
    const file = audioFileRef.current;
    if (!file) return;
    setTranscribing(true); setTranscribeError('');
    try {
      const form = new FormData();
      form.append('audio', file);
      const res  = await fetch('/api/transcribe', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al transcribir');
      const built: Cue[] = data.cues;
      setCues(built); cuesRef.current = built; setSrtLoaded(true);
    } catch (e) {
      setTranscribeError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setTranscribing(false);
    }
  }

  function downloadSRT() {
    if (cues.length === 0) return;
    const pad = (n: number, d = 2) => String(n).padStart(d, '0');
    const toSRTTime = (s: number) => {
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = Math.floor(s % 60);
      return `${pad(h)}:${pad(m)}:${pad(sc)},${pad(Math.round((s % 1) * 1000), 3)}`;
    };
    const text = cues.map((c, i) => `${i + 1}\n${toSRTTime(c.start)} --> ${toSRTTime(c.end)}\n${c.text}`).join('\n\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = 'karaoke2.srt'; a.click();
  }

  // ── Detección de secciones ─────────────────────────────────────────────
  async function detectSections() {
    if (cues.length === 0) return;
    setDetectingSection(true); setDetectError('');
    try {
      const res  = await fetch('/api/detect-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cues }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en la detección');

      const newSections: Section[] = (data.sections as { type: string; label: string; startTime: number; endTime: number }[])
        .map((s, i) => ({
          id:        `sec-${i}-${Date.now()}`,
          type:      (s.type as SectionType) || 'other',
          label:     s.label,
          startTime: s.startTime,
          endTime:   s.endTime,
          image:     null,
          imageName: '',
        }));

      setSections(newSections);
      sectionsRef.current = newSections;
      prevSectionIdxRef.current = -1;
      sectionTransRef.current   = null;
    } catch (e) {
      setDetectError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setDetectingSection(false);
    }
  }

  async function detectSongStyle() {
    if (cues.length === 0) return;
    setDetectingStyle(true);
    try {
      const fullLyrics = cues.map(c => c.text).join(' ');
      const res  = await fetch('/api/song-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullLyrics }),
      });
      const data = await res.json();
      if (data.style) { setSongStyle(data.style); setStyleReason(data.reason ?? ''); }
    } catch { /* silencioso */ } finally {
      setDetectingStyle(false);
    }
  }

  function onSectionImageChange(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      setSections(prev => {
        const next = prev.map(s => s.id === id ? { ...s, image: img, imageName: f.name } : s);
        sectionsRef.current = next;
        return next;
      });
    };
    img.src = url;
  }

  const ready = audioLoaded && cues.length > 0;

  // Inline style for section card accent
  const cardBorder = (type: SectionType) => `1px solid ${SECTION_COLORS[type]}44`;
  const cardDot    = (type: SectionType): React.CSSProperties => ({
    display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
    background: SECTION_COLORS[type], marginRight: 6, flexShrink: 0,
  });

  return (
    <div className="karaoke-page">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🎵</span>
            <span className="logo-text">Canciones</span>
          </div>
          <a href="/" className="nav-btn">← Volver</a>
        </div>
      </header>

      <div className="karaoke-body">
        <h1 className="karaoke-title">KARAOKE 2<span>por secciones</span></h1>

        {/* File loaders */}
        <div className="kk-upload-row">

          {/* ── Letra / SRT ── */}
          <div className="kk-upload-block">
            <div className="kk-mode-row">
              <button className={`kk-mode-btn${inputMode === 'tap' ? ' active' : ''}`} onClick={() => setInputMode('tap')}>✏️ Letra</button>
              <button className={`kk-mode-btn${inputMode === 'srt' ? ' active' : ''}`} onClick={() => setInputMode('srt')}>📄 SRT</button>
              <button className={`kk-mode-btn${inputMode === 'ai'  ? ' active' : ''}`} onClick={() => setInputMode('ai')}>🤖 IA</button>
            </div>

            {inputMode === 'srt' && (
              <>
                <label className="kk-label">Archivo SRT</label>
                <button className={`kk-drop${srtLoaded ? ' loaded' : ''}`} onClick={() => document.getElementById('srt-in2')?.click()}>
                  {srtLoaded ? `✅ ${srtName}` : '📄 Seleccionar .srt'}
                </button>
                <input type="file" id="srt-in2" accept=".srt" style={{ display: 'none' }} onChange={onSrtChange} />
              </>
            )}

            {inputMode === 'ai' && (
              <div className="kk-tap-ready">
                <p className="kk-tap-info">
                  Transcribe el audio con IA y genera los timestamps por palabra automáticamente.<br/>
                  Requiere <strong>DEEPGRAM_API_KEY</strong> en <code>.env</code>
                </p>
                {!transcribing && cues.length === 0 && (
                  <button className="kk-btn primary" onClick={transcribeAudio} disabled={!audioLoaded}>
                    {audioLoaded ? '🤖 Transcribir audio' : 'Carga el audio primero'}
                  </button>
                )}
                {transcribing && <p className="kk-tap-info" style={{ color: '#facc15' }}>⏳ Transcribiendo…</p>}
                {transcribeError && <p className="kk-tap-info" style={{ color: '#ff4444' }}>⚠ {transcribeError}</p>}
                {cues.length > 0 && !transcribing && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p className="kk-tap-info">✅ {cues.length} palabras detectadas</p>
                    <button className="kk-btn primary" onClick={transcribeAudio} disabled={!audioLoaded}>🔄 Re-transcribir</button>
                    <button className="kk-btn" onClick={downloadSRT}>⬇ Descargar SRT</button>
                  </div>
                )}
              </div>
            )}

            {inputMode === 'tap' && cues.length === 0 && !tapping && tapLines.length === 0 && (
              <>
                <label className="kk-label">Letra de la canción (una frase por línea)</label>
                <textarea
                  className="kk-lyrics-textarea"
                  rows={7}
                  placeholder={'Pega la letra aquí\nUna frase por línea\nCada línea = un cue'}
                  value={lyricsText}
                  onChange={e => setLyricsText(e.target.value)}
                />
                <button className="kk-btn primary" style={{ marginTop: 8 }} onClick={prepareLyrics} disabled={!lyricsText.trim()}>
                  Preparar letra →
                </button>
              </>
            )}

            {inputMode === 'tap' && cues.length === 0 && !tapping && tapLines.length > 0 && (
              <div className="kk-tap-ready">
                <p className="kk-tap-info">{tapLines.length} frases listas. Carga el audio y presiona Iniciar.</p>
                <button className="kk-btn primary" onClick={startTapping} disabled={!audioLoaded}>▶ Iniciar tap sync</button>
                <button className="kk-btn" style={{ marginTop: 6 }} onClick={() => { setTapLines([]); tapLinesRef.current = []; }}>← Editar letra</button>
              </div>
            )}

            {inputMode === 'tap' && tapping && (
              <div className="kk-tap-active">
                <div className="kk-tap-counter">{tapIdx} / {tapLines.length}</div>
                {tapIdx > 0 && (
                  <div className={`kk-tap-active-line kk-tap-line--${tapLineStatus}`}>{tapLines[tapIdx - 1]}</div>
                )}
                {tapIdx < tapLines.length ? (
                  <div className="kk-tap-line kk-tap-line--ready">{tapLines[tapIdx]}</div>
                ) : (
                  <div className="kk-tap-line kk-tap-line--waiting" style={{ fontSize: 15, opacity: 0.7 }}>
                    ← Presiona <kbd>Enter</kbd> / FIN para terminar
                  </div>
                )}
                <div className="kk-tap-btns">
                  <button className="kk-tap-btn" onClick={registerTap} disabled={tapIdx >= tapLines.length}>TAP</button>
                  <button className="kk-end-btn" onClick={registerEnd} disabled={tapIdx === 0}>FIN</button>
                </div>
                <p className="kk-tap-hint"><kbd>Espacio</kbd> = inicio &nbsp;·&nbsp; <kbd>Enter</kbd> = fin</p>
                <button className="kk-btn" style={{ marginTop: 6 }} onClick={finishTapping}>Finalizar ahora</button>
              </div>
            )}

            {inputMode === 'tap' && cues.length > 0 && !tapping && (
              <div className="kk-tap-ready">
                <p className="kk-tap-info">✅ {cues.length} frases sincronizadas</p>
                <button className="kk-btn" onClick={resetTap}>↺ Re-sincronizar</button>
              </div>
            )}
          </div>

          <div className="kk-upload-block">
            <label className="kk-label">Audio (mp3, wav, ogg…)</label>
            <button className={`kk-drop${audioLoaded ? ' loaded' : ''}`} onClick={() => document.getElementById('audio-in2')?.click()}>
              {audioLoaded ? `✅ ${audioName}` : '🎵 Seleccionar audio'}
            </button>
            <input type="file" id="audio-in2" accept="audio/*" style={{ display: 'none' }} onChange={onAudioChange} />
          </div>

          <div className="kk-upload-block">
            <label className="kk-label">Fondo global (jpg, png…) — fallback</label>
            <button className={`kk-drop${bgImage ? ' loaded' : ''}`} onClick={() => document.getElementById('bg-in2')?.click()}>
              {bgImage ? `✅ ${bgName}` : '🖼 Seleccionar imagen'}
            </button>
            {bgImage && (
              <button className="kk-drop" style={{ marginTop: 6, fontSize: 12 }} onClick={removeBg}>
                ✕ Quitar (usar chroma)
              </button>
            )}
            <input type="file" id="bg-in2" accept="image/*" style={{ display: 'none' }} onChange={onBgChange} />
          </div>
        </div>

        {/* ── Detección de secciones ──────────────────────────────────── */}
        {cues.length > 0 && (
          <div style={{
            width: '100%', maxWidth: 700,
            background: '#111', border: '1px solid #252525',
            borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: sections.length ? 12 : 0 }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#ccc' }}>🎼 Secciones</span>
              <button
                className={`kk-btn${sections.length > 0 ? '' : ' primary'}`}
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                onClick={detectSections}
                disabled={detectingSection}
              >
                {detectingSection ? '⏳ Detectando con IA…' : sections.length > 0 ? '🔄 Re-detectar' : '🤖 Detectar secciones con IA'}
              </button>
              {sections.length > 0 && (
                <span style={{ fontSize: '0.75rem', color: '#666' }}>{sections.length} secciones — sube una foto para cada una</span>
              )}
            </div>

            {detectError && (
              <p style={{ color: '#f87171', fontSize: '0.8rem', margin: '8px 0 0' }}>⚠ {detectError}</p>
            )}

            {/* ── Estilo visual global ──────────────────────────────── */}
            {sections.length > 0 && (
              <div style={{ background: '#0f0a1a', border: '1px solid #7c3aed33', borderRadius: 10, padding: '0.75rem', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#c084fc' }}>🎨 Estilo visual</span>
                  <button
                    onClick={detectSongStyle}
                    disabled={detectingStyle}
                    style={{
                      padding: '3px 10px', borderRadius: 6, fontSize: '0.75rem', cursor: detectingStyle ? 'default' : 'pointer',
                      background: '#7c3aed22', border: '1px solid #7c3aed55', color: detectingStyle ? '#666' : '#c084fc',
                    }}
                  >
                    {detectingStyle ? '⏳ Detectando…' : '✨ Sugerir por IA'}
                  </button>
                </div>
                <select
                  value={songStyle}
                  onChange={e => { setSongStyle(e.target.value); setStyleReason(''); }}
                  style={{
                    width: '100%', padding: '0.4rem 0.5rem', borderRadius: 6,
                    background: '#1a1a2a', border: '1px solid #7c3aed44', color: '#eee',
                    fontSize: '0.8rem', marginBottom: songStyle ? '0.4rem' : 0,
                  }}
                >
                  <option value="">— Seleccionar estilo —</option>
                  <optgroup label="Fotografía">
                    <option value="cinematic photography, dramatic lighting, shallow depth of field, 35mm film grain, anamorphic lens">Cinematográfico</option>
                    <option value="editorial fashion photography, high contrast, studio lighting, moody atmosphere">Editorial / Moda</option>
                    <option value="vintage photography, warm sepia tones, aged film texture, nostalgic mood">Vintage / Retro</option>
                    <option value="documentary photography, raw and authentic, natural lighting, street style">Documental</option>
                  </optgroup>
                  <optgroup label="Ilustración">
                    <option value="detailed digital art illustration, vibrant colors, concept art style, highly detailed">Digital Art</option>
                    <option value="anime style, cel shading, vibrant colors, expressive characters, dynamic composition">Anime / Manga</option>
                    <option value="oil painting style, rich textures, classical composition, painterly brushstrokes">Pintura al óleo</option>
                    <option value="watercolor illustration, soft washes, delicate lines, pastel palette, dreamy mood">Acuarela</option>
                    <option value="fantasy illustration, magical atmosphere, epic scale, intricate details, ethereal lighting">Fantasía épica</option>
                  </optgroup>
                  <optgroup label="Estético">
                    <option value="neon cyberpunk aesthetic, dark urban environment, electric blue and magenta neon lights, rain reflections">Neon / Cyberpunk</option>
                    <option value="dark moody atmosphere, deep shadows, dramatic chiaroscuro lighting, mysterious and intense">Oscuro y dramático</option>
                    <option value="bright pop art, bold graphic shapes, vivid saturated colors, flat design, energetic">Pop Art</option>
                    <option value="lo-fi aesthetic, soft grain, muted warm tones, cozy and melancholic atmosphere">Lo-fi / Chill</option>
                    <option value="surreal dreamlike scene, impossible geometry, soft ethereal light, magical realism">Surrealista</option>
                  </optgroup>
                </select>
                {songStyle && styleReason && (
                  <p style={{ fontSize: '0.72rem', color: '#9f7aea', margin: 0, fontStyle: 'italic' }}>💡 {styleReason}</p>
                )}
                {songStyle && !styleReason && (
                  <p style={{ fontSize: '0.72rem', color: '#666', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{songStyle}</p>
                )}
              </div>
            )}

            {sections.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                {sections.map(sec => (
                  <div key={sec.id} style={{
                    border: cardBorder(sec.type), borderRadius: 8,
                    padding: '0.6rem 0.7rem', background: '#161616',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                      <span style={cardDot(sec.type)} />
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#eee' }}>{sec.label}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: 6 }}>
                      {fmt(sec.startTime)} – {fmt(sec.endTime)}
                    </div>
                    <button
                      className={`kk-drop${sec.image ? ' loaded' : ''}`}
                      style={{ fontSize: '0.72rem', padding: '6px 8px' }}
                      onClick={() => setModalSec(sec)}
                    >
                      {sec.image ? `✅ ${sec.imageName}` : '🖼 Subir foto'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Canvas */}
        <div className="kk-stage-wrap">
          <canvas ref={canvasRef} width={canvasDims.w} height={canvasDims.h} />
        </div>

        {/* Format toggle */}
        <div className="kk-mode-row" style={{ marginBottom: 4 }}>
          <button className={`kk-mode-btn${format === '9:16' ? ' active' : ''}`} onClick={() => setFormat('9:16')} disabled={recording}>📱 9:16 Vertical</button>
          <button className={`kk-mode-btn${format === '16:9' ? ' active' : ''}`} onClick={() => setFormat('16:9')} disabled={recording}>🖥 16:9 Horizontal</button>
        </div>

        {/* Glitch controls */}
        <div className="kk-mode-row" style={{ marginBottom: 8 }}>
          <button className={`kk-mode-btn${glitchEnabled ? ' active' : ''}`}
            onClick={() => { glitchEnabledRef.current = !glitchEnabled; setGlitchEnabled(g => !g); }}>
            ⚡ Glitch {glitchEnabled ? 'ON' : 'OFF'}
          </button>
          <button className={`kk-mode-btn${glitchStyle === 'digital' ? ' active' : ''}`}
            onClick={() => { glitchStyleRef.current = 'digital'; setGlitchStyle('digital'); }}
            disabled={!glitchEnabled} title="Digital: row shifts + chromatic aberration + noise">
            📺 Digital
          </button>
          <button className={`kk-mode-btn${glitchStyle === 'analog' ? ' active' : ''}`}
            onClick={() => { glitchStyleRef.current = 'analog'; setGlitchStyle('analog'); }}
            disabled={!glitchEnabled} title="VHS: pixel sort + onda seno + inversión + tracking lines">
            📼 VHS
          </button>
          <button className="kk-mode-btn" onClick={() => triggerGlitch(1)}
            disabled={!glitchEnabled || !audioLoaded} title="Dispara glitch máximo">
            💥 Drop!
          </button>
        </div>

        {/* Controls */}
        <div className="kk-controls">
          <button className="kk-btn primary" onClick={togglePlay} disabled={!ready}>
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <button className={`kk-btn ${recording ? 'danger' : 'rec'}`} onClick={toggleRecord} disabled={!ready}>
            {recording ? '⏹ Detener grabación' : '⏺ Grabar video'}
          </button>
          <button className={`kk-btn ${recording ? 'danger' : 'rec'}`} onClick={toggleTransparentRecord} disabled={!ready}
            title="Graba sin fondo — importa en CapCut sin chroma key">
            {recording ? '⏹ Detener grabación' : '⏺ Grabar transparente'}
          </button>
          <button className="kk-btn rec" onClick={startSample} disabled={!ready || recording}>
            ⏺ Grabar muestra (30s)
          </button>
          <div className="kk-timeline" onClick={seekTo}>
            <div className="kk-timeline-fill" style={{ width: progress.toFixed(2) + '%' }} />
          </div>
          <div className="kk-time">{timeLabel}</div>
        </div>

        {/* Status + download */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%', maxWidth: '700px' }}>
          <span className={`kk-badge${recording ? ' recording' : blobUrl ? ' ready' : ''}`}>
            <span className="kk-dot" />
            {recording ? 'Grabando…' : blobUrl ? '✓ Video listo para descargar' : ready ? 'Listo — presiona Grabar video' : !audioLoaded ? 'Carga el audio' : 'Sincroniza la letra'}
          </span>
          {blobUrl && (
            <>
              <button className="kk-btn primary" onClick={downloadVideo}>
                {isTransparentRec ? '⬇ Descargar .webm transparente' : '⬇ Descargar .webm'}
              </button>
            </>
          )}
        </div>

        <div className="kk-info">
          <strong>Karaoke 2:</strong> Después de cargar la letra, usa <strong>🤖 Detectar secciones con IA</strong> para que Claude identifique automáticamente los versos, coros, puentes, etc. Luego sube una foto para cada sección — el fondo cambiará automáticamente durante la grabación.<br /><br />
          El fondo global se usa como fallback si alguna sección no tiene foto asignada. Todo lo demás funciona igual que el Karaoke original.
        </div>
      </div>

      <audio ref={audRef} onEnded={() => { if (recording) stopRecord(); setPlaying(false); }} />

      {/* ── Modal de detalle de escena ───────────────────────────────── */}
      {modalSec && (() => {
        const sec     = sections.find(s => s.id === modalSec.id) ?? modalSec;
        const secCues = cues.filter(c => c.start >= sec.startTime && c.start < sec.endTime);
        const color   = SECTION_COLORS[sec.type];
        const lyricsText = secCues.map(c => c.text).join(' ');

        async function generatePrompt() {
          if (!lyricsText || generatingPrompt) return;
          setGeneratingPrompt(true);
          setImgPrompt('');
          try {
            const fullLyrics = cues.map(c => c.text).join(' ');
            const res = await fetch('/api/image-prompt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lyrics: lyricsText, fullLyrics, sectionLabel: sec.label, sectionType: sec.type, songStyle }),
            });
            const data = await res.json();
            setImgPrompt(data.prompt ?? data.error ?? 'Error al generar');
          } catch {
            setImgPrompt('Error de conexión');
          } finally {
            setGeneratingPrompt(false);
          }
        }

        return (
          <div
            onClick={() => { setModalSec(null); setImgPrompt(''); }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9999, padding: '1rem',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#1a1a1a', border: `1px solid ${color}55`,
                borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 480,
                maxHeight: '85vh', overflowY: 'auto',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#eee' }}>{sec.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#666' }}>
                  {fmt(sec.startTime)} – {fmt(sec.endTime)}
                </span>
              </div>

              {/* Lyrics preview */}
              <div style={{
                background: '#111', borderRadius: 10, padding: '0.75rem 1rem',
                marginBottom: '1rem', minHeight: 60,
                fontSize: '0.85rem', color: '#ccc', lineHeight: 1.8,
              }}>
                {secCues.length > 0
                  ? secCues.map((c, i) => <span key={i}>{c.text}{' '}</span>)
                  : <span style={{ color: '#555' }}>Sin letra en esta sección</span>}
              </div>

              {/* Generador de prompt de imagen */}
              {secCues.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={generatePrompt}
                    disabled={generatingPrompt}
                    style={{
                      width: '100%', padding: '0.6rem', borderRadius: 10,
                      background: generatingPrompt ? '#222' : '#2a1a3a',
                      border: '1px solid #7c3aed66', color: generatingPrompt ? '#666' : '#c084fc',
                      fontWeight: 700, fontSize: '0.85rem', cursor: generatingPrompt ? 'default' : 'pointer',
                      marginBottom: imgPrompt ? '0.6rem' : 0,
                    }}
                  >
                    {generatingPrompt ? '⏳ Generando prompt…' : '✨ Generar prompt para imagen'}
                  </button>

                  {imgPrompt && (
                    <div style={{ position: 'relative' }}>
                      <div style={{
                        background: '#0f0a1a', border: '1px solid #7c3aed44',
                        borderRadius: 10, padding: '0.75rem 2.5rem 0.75rem 0.85rem',
                        fontSize: '0.8rem', color: '#d8b4fe', lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                      }}>
                        {imgPrompt}
                      </div>
                      <button
                        onClick={() => navigator.clipboard.writeText(imgPrompt)}
                        title="Copiar"
                        style={{
                          position: 'absolute', top: 8, right: 8,
                          background: '#7c3aed33', border: 'none', borderRadius: 6,
                          color: '#c084fc', cursor: 'pointer', padding: '3px 7px', fontSize: '0.8rem',
                        }}
                      >
                        📋
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Preview imagen actual */}
              {sec.image && (
                <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                  <img
                    src={sec.image.src}
                    alt="preview"
                    style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, objectFit: 'cover' }}
                  />
                  <p style={{ fontSize: '0.75rem', color: '#666', marginTop: 4 }}>{sec.imageName}</p>
                </div>
              )}

              {/* Botones */}
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{
                  flex: 1, display: 'block', textAlign: 'center',
                  padding: '0.65rem', borderRadius: 10, cursor: 'pointer',
                  background: color + '22', border: `1px solid ${color}66`,
                  color: '#eee', fontWeight: 700, fontSize: '0.9rem',
                }}>
                  {sec.image ? '🔄 Cambiar foto' : '🖼 Elegir foto'}
                  <input
                    type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => {
                      onSectionImageChange(sec.id, e);
                      setModalSec(null);
                      setImgPrompt('');
                    }}
                  />
                </label>
                <button
                  onClick={() => { setModalSec(null); setImgPrompt(''); }}
                  style={{
                    padding: '0.65rem 1rem', borderRadius: 10, border: '1px solid #333',
                    background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '0.9rem',
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
