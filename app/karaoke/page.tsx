'use client';
import { useRef, useState, useEffect, useCallback } from 'react';

type Cue      = { start: number; end: number; text: string };
type Particle = { x: number; y: number; vx: number; vy: number; size: number; alpha: number; hue: number; pulse: number };

function easeOutBack(x: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
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
      const m = ls[1].match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
      if (!m) return null;
      const ts = (h: string, mi: string, s: string, ms: string) => +h * 3600 + +mi * 60 + +s + +ms / 1000;
      return {
        start: ts(m[1], m[2], m[3], m[4]),
        end: ts(m[5], m[6], m[7], m[8]),
        text: ls.slice(2).join(' ').replace(/<[^>]+>/g, '').trim(),
      };
    })
    .filter(Boolean) as Cue[];
}

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

// Dimensiones actualizables según formato seleccionado (9:16 | 16:9)
let W = 1080, H = 1920;
let FS = 104, LH = FS * 1.30, MG = 80, MAX_W = W - MG * 2;

function applyFormat(fmt: '9:16' | '16:9') {
  if (fmt === '16:9') { W = 1920; H = 1080; }
  else                { W = 1080; H = 1920; }
  FS = 104; LH = FS * 1.30; MG = 80; MAX_W = W - MG * 2;
}
const ALIGNS = ['center', 'left', 'right', 'center', 'right', 'left'] as const;

// ── Jerarquía tipográfica ──────────────────────────────────────────────────
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
  glowMult:     number;  // multiplicador del shadowBlur activo
  activeColor:  string;  // color fill mientras se canta
  shadowColor:  string;  // color del glow activo
  upcomingColor: string; // color cuando está en espera
  upcomingAlpha: number; // opacidad en espera
};

function getWordStyle(word: string): WordStyle {
  const w = word.replace(/[^a-záéíóúüñ]/gi, '').toLowerCase();
  if (STOPWORDS_ES.has(w)) return {   // artículos, preposiciones → azul
    glowMult:      0.28,
    activeColor:   '#b0b0b0',         // gris claro al cantar
    shadowColor:   '#806000',         // dorado oscuro al cantar
    upcomingColor: '#38bdf8',         // azul cielo — contraste con fucsia
    upcomingAlpha: 0.75,
  };
  if (w.length >= 7) return {         // palabras largas/emocionales → máximo brillo
    glowMult:      1.70,
    activeColor:   '#ffffff',
    shadowColor:   '#facc15',         // dorado pleno
    upcomingColor: '#ff6d00',         // naranja brillante
    upcomingAlpha: 1.0,
  };
  return {                            // palabras normales → comportamiento base
    glowMult:      1.0,
    activeColor:   '#ffffff',
    shadowColor:   '#facc15',
    upcomingColor: '#ff8c00',
    upcomingAlpha: 0.82,
  };
}

// ── Glitch — Combo A: Digital / Datamosh ──────────────────────────────────
function applyGlitch(ctx: CanvasRenderingContext2D, snap: HTMLCanvasElement, g: number) {
  // 1. Pixel row shifting — arrastra filas horizontalmente (pixel sorting simulado)
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

  // 2. Chromatic aberration — ghost del snapshot pre-glitch desplazado R/B
  const caShift = Math.round(g * 20);
  if (caShift >= 2) {
    ctx.save();
    ctx.globalAlpha = 0.30 * g;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(snap, -caShift, 0); // fantasma izquierdo
    ctx.drawImage(snap,  caShift, 0); // fantasma derecho
    ctx.restore();
  }

  // 3. Color noise — píxeles de colores aleatorios sobre el glitch
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

  // 4. Screen tear — copia un bloque del snapshot y lo pega desplazado
  if (g > 0.40 && Math.random() < 0.45) {
    const ty = Math.floor(Math.random() * H);
    const th = Math.floor(12 + Math.random() * 100);
    const tx = Math.round((Math.random() * 2 - 1) * g * 140);
    ctx.drawImage(snap, 0, ty, W, th, tx, ty, W, th);
  }
}

// ── Glitch — Combo B: VHS / Analógico ────────────────────────────────────
function applyGlitch2(ctx: CanvasRenderingContext2D, _snap: HTMLCanvasElement, g: number) {
  const imgData = ctx.getImageData(0, 0, W, H);
  const data    = imgData.data;

  // 1. Pixel sort real por luminancia — segmentos brillantes se ordenan y "derriten"
  const sortRows = Math.ceil(g * 60);
  const thresh   = 75 + (1 - g) * 95; // umbral de brillo: baja con la intensidad
  for (let i = 0; i < sortRows; i++) {
    const y    = Math.floor(Math.random() * H);
    const base = y * W * 4;
    // Construir array de píxeles con su luminancia
    const px: { r: number; gr: number; b: number; a: number; lum: number }[] = [];
    for (let x = 0; x < W; x++) {
      const o = base + x * 4;
      const r = data[o], gr = data[o+1], b = data[o+2], a = data[o+3];
      px.push({ r, gr, b, a, lum: 0.299*r + 0.587*gr + 0.114*b });
    }
    // Encontrar segmentos por encima del umbral y ordenarlos
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

  // 2. Onda seno suave — desplazamiento orgánico (no aleatorio como el combo A)
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

  // 3. Inversión de color en strips — bandas de color negativo
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

  // 4. Líneas de tracking VHS — franjas brillantes finas (sin getImageData)
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

export default function KaraokePage() {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const audRef      = useRef<HTMLAudioElement>(null);
  const animRef     = useRef<number>(0);
  const recRef      = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<BlobPart[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const videoBlobUrlRef     = useRef<string>('');
  const audioBlobUrlRef     = useRef<string>('');
  const bgBlobUrlRef        = useRef<string>('');
  const transparentRecRef   = useRef(false);

  const particlesRef    = useRef<Particle[]>([]);
  const cueLayoutRef    = useRef<CueLayout[]>([]);
  const scrollYRef      = useRef(0);
  const scrollVelRef    = useRef(0);
  const [displayMode, setDisplayMode] = useState<'scroll' | 'page'>('scroll');
  const [format, setFormat]           = useState<'9:16' | '16:9'>('9:16');
  const [canvasDims, setCanvasDims]   = useState({ w: 1080, h: 1920 });
  const displayModeRef  = useRef<'scroll' | 'page'>('scroll');

  const [cues, setCues]             = useState<Cue[]>([]);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [srtLoaded, setSrtLoaded]   = useState(false);
  const [srtName, setSrtName]       = useState('');
  const [audioName, setAudioName]   = useState('');
  const [playing, setPlaying]       = useState(false);
  const [recording, setRecording]           = useState(false);
  const [blobUrl, setBlobUrl]               = useState<string | null>(null);
  const [convertingMp4, setConvertingMp4]   = useState(false);
  const [isTransparentRec, setIsTransparentRec] = useState(false);
  const [isNativeMp4, setIsNativeMp4]   = useState(false);
  const [progress, setProgress]     = useState(0);
  const [timeLabel, setTimeLabel]   = useState('0:00 / 0:00');
  const [activeCue, setActiveCue]   = useState(-1);
  const cueListRef = useRef<HTMLDivElement>(null);
  const [bgImage, setBgImage]       = useState<HTMLImageElement | null>(null);
  const [bgName, setBgName]         = useState('');
  const bgImageRef  = useRef<HTMLImageElement | null>(null);
  const audioFileRef = useRef<File | null>(null);

  // ── Glitch ─────────────────────────────────────────────────────────────
  const analyserRef      = useRef<AnalyserNode | null>(null);
  const freqDataRef      = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const glitchRef        = useRef(0);
  const glitchEnabledRef = useRef(true);
  const offCanvasRef     = useRef<HTMLCanvasElement | null>(null);
  const [glitchEnabled, setGlitchEnabled] = useState(true);
  const [glitchStyle, setGlitchStyle]     = useState<'digital' | 'analog'>('digital');
  const glitchStyleRef = useRef<'digital' | 'analog'>('digital');

  // ── Transcripción IA ───────────────────────────────────────────────────
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState('');

  // ── Tap-sync state ─────────────────────────────────────────────────────
  const [inputMode, setInputMode]   = useState<'srt' | 'tap' | 'ai'>('ai');
  const [lyricsText, setLyricsText] = useState('');
  const [tapLines, setTapLines]     = useState<string[]>([]);
  const [tapping, setTapping]         = useState(false);
  const [tapIdx, setTapIdx]           = useState(0);
  const [tapLineStatus, setTapLineStatus] = useState<'waiting' | 'started' | 'ended'>('waiting');
  // refs so the keydown handler always sees current values
  const tappingRef       = useRef(false);
  const tapIdxRef        = useRef(0);
  const tapTimestampsRef = useRef<number[]>([]);
  const tapEndsRef       = useRef<(number | null)[]>([]); // null = usar inicio del siguiente
  const tapLinesRef      = useRef<string[]>([]);

  // ── Particles init ─────────────────────────────────────────────────────
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

  // ── Fonts ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const f1 = new FontFace('Bebas Neue', "url('https://fonts.gstatic.com/s/bebasneue/v14/JTUSjIg69CK48gW7PXoo9WdhyyTh89ZNpQ.woff2')");
    const f2 = new FontFace('DM Sans',    "url('https://fonts.gstatic.com/s/dmsans/v14/rP2Hp2ywxg089UriCZOIHQ.woff2')");
    Promise.all([f1.load(), f2.load()]).then(fonts => {
      fonts.forEach(f => document.fonts.add(f));
      // Recompute layout after font loads (measurements differ from fallback font)
      if (cueLayoutRef.current.length > 0) {
        const tmp = document.createElement('canvas');
        const tc  = tmp.getContext('2d')!;
        cueLayoutRef.current = computeCueLayout(tc, cuesRef.current);
      }
    });
  }, []);

  // ── Layout: recompute when cues change ────────────────────────────────
  useEffect(() => {
    scrollYRef.current = 0; // reset scroll on new song
    if (cues.length === 0) { cueLayoutRef.current = []; return; }
    const tmp = document.createElement('canvas');
    const tc  = tmp.getContext('2d')!;
    cueLayoutRef.current = computeCueLayout(tc, cues);
  }, [cues]);

  // ── Format: update dimensions + re-layout when format changes ─────────
  useEffect(() => {
    applyFormat(format);
    setCanvasDims({ w: W, h: H });
    // Update canvas element directly to avoid clearing it twice
    const canvas = canvasRef.current;
    if (canvas) { canvas.width = W; canvas.height = H; }
    // Re-layout cues with new dimensions
    if (cuesRef.current.length > 0) {
      const tmp = document.createElement('canvas');
      const tc  = tmp.getContext('2d')!;
      cueLayoutRef.current = computeCueLayout(tc, cuesRef.current);
    }
    // Destroy offscreen cache so it's recreated at new size
    offCanvasRef.current = null;
  }, [format]);

  // ── Draw ───────────────────────────────────────────────────────────────
  const drawFrame = useCallback((t: number, cueList: Cue[]) => {
    const canvas = canvasRef.current;
    const aud    = audRef.current;
    if (!canvas || !aud) return;
    const ctxOrNull = canvas.getContext('2d');
    if (!ctxOrNull) return;
    const ctx   = ctxOrNull;
    const ctxLS = ctx as CanvasRenderingContext2D & { letterSpacing: string };

    // ── Background ────────────────────────────────────────────────────────
    if (bgImageRef.current) {
      ctx.drawImage(bgImageRef.current, 0, 0, W, H);
    } else if (transparentRecRef.current) {
      ctx.clearRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#FF00FF';
      ctx.fillRect(0, 0, W, H);
    }

    // ── Cue detection ─────────────────────────────────────────────────────
    const idx  = cueList.findIndex(c => t >= c.start && t <= c.end);
    const curr = idx >= 0 ? cueList[idx] : null;

    const FLY_DUR = 0.50; // duración salida Z-axis

    // Z-axis fly-through: la palabra crece y se desvanece (cámara la atraviesa)
    function drawFlyThrough(wordText: string, cx: number, cy: number, age: number, fs: number) {
      const p     = age / FLY_DUR;
      const ep    = easeInCubic(p);     // acelera exponencialmente
      const sc    = 1 + ep * 1.9;       // crece: 1.0 → 2.9
      const alpha = 1 - p;              // desvanece linealmente
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

    // ── Renderer: scroll continuo o páginas de 8 ────────────────────────
    if (displayModeRef.current === 'scroll') {
    // ════════════════ MODO SCROLL ════════════════
    const layout = cueLayoutRef.current;
    if (layout.length > 0) {
      // Which layout item to center on screen
      let targetIdx = idx;
      if (targetIdx < 0) {
        const nextIdx = cueList.findIndex(c => c.start > t);
        targetIdx = nextIdx >= 0 ? nextIdx : cueList.length - 1;
      }
      const targetItem = layout[targetIdx];
      if (targetItem) {
        // Spring physics: suave con ligera inercia (más cinético que lerp simple)
        const targetScrollY = targetItem.y - H * 0.45;
        const dx = targetScrollY - scrollYRef.current;
        scrollVelRef.current = scrollVelRef.current * 0.76 + dx * 0.040;
        scrollYRef.current  += scrollVelRef.current;
      }

      const scrollY = scrollYRef.current;
      // Visibility range in virtual space (cull words outside screen + 2 lines padding)
      const visMin = scrollY - LH * 2;
      const visMax = scrollY + H + LH * 2;

      // Apply scroll transform — all virtual coords shift to screen coords
      ctx.save();
      ctx.translate(0, -scrollY);

      ctxLS.letterSpacing = '3px';
      ctx.font = `900 ${FS}px "Bebas Neue"`;

      const ENTRY_DUR = 0.28;

      for (let i = 0; i < layout.length; i++) {
        const { cue, x, y, ww, fs } = layout[i];
        if (y < visMin || y > visMax) continue; // cull

        const isActive    = t >= cue.start && t <= cue.end;
        const isCompleted = t > cue.end;
        ctx.globalAlpha = 1;
        ctx.shadowBlur  = 0;

        const ws = getWordStyle(cue.text);

        if (isActive) {
          const entryAge   = t - cue.start;
          const entryP     = Math.min(1, entryAge / ENTRY_DUR);
          const entrySc    = 0.18 + easeOutExpo(entryP) * 0.82;
          const entryAlpha = Math.min(1, entryP * 4);

          ctx.save();
          ctx.translate(x + ww * 0.5, y);
          ctx.scale(entrySc, entrySc);
          ctx.globalAlpha = entryAlpha;

          ctxLS.letterSpacing = '0px';
          ctx.font        = `900 ${fs}px "Bebas Neue"`;
          ctx.textAlign   = 'left';
          ctx.strokeStyle = 'rgba(0,0,0,0.92)';
          ctx.lineJoin    = 'round';
          ctx.lineWidth   = fs * 0.04;
          const letters   = cue.text.split('');
          const wordW     = ctx.measureText(cue.text).width;
          const wScl      = 1.0 + Math.sin(t * 9.5) * 0.018;
          ctx.scale(wScl, wScl);
          let lx = -wordW / 2;
          letters.forEach((ch, ci) => {
            const cw  = ctx.measureText(ch).width;
            const wy  = Math.sin(t * 9 + ci * 1.5) * 5;
            const glow = (24 + Math.sin(t * 5.5 + ci * 0.9) * 13) * ws.glowMult;
            // fill+shadow primero → glow queda detrás del trazo
            ctx.shadowColor = ws.shadowColor;
            ctx.shadowBlur  = glow;
            ctx.fillStyle   = ws.activeColor;
            ctx.fillText(ch, lx, wy);
            // stroke encima sin sombra → borde limpio que tapa el glow interior
            ctx.shadowBlur = 0;
            ctx.strokeText(ch, lx, wy);
            lx += cw;
          });
          ctx.restore();
          ctxLS.letterSpacing = '3px';

        } else if (isCompleted) {
          const age = t - cue.end;
          if (age < FLY_DUR) drawFlyThrough(cue.text, x + ww / 2, y, age, fs);

        } else {
          ctx.font        = `900 ${fs}px "Bebas Neue"`;
          ctx.shadowColor = ws.upcomingColor;
          ctx.shadowBlur  = 8 * ws.upcomingAlpha;
          ctx.fillStyle   = ws.upcomingColor;
          ctx.globalAlpha = ws.upcomingAlpha;
          ctx.textAlign   = 'left';
          ctx.fillText(cue.text, x, y);
          ctx.globalAlpha = 1;
          ctx.shadowBlur  = 0;
        }
      }

      ctx.restore(); // end scroll transform

      // Progress bar — drawn in screen space (no scroll)
      if (curr) {
        const cueDur  = Math.max(curr.end - curr.start, 0.01);
        const cueProg = Math.min(1, (t - curr.start) / cueDur);
        const barY    = H * 0.90;
        const barW    = W * 0.80;
        const barX    = W / 2 - barW / 2;
        ctx.fillStyle = '#1a4a28';
        ctx.beginPath(); ctx.roundRect(barX, barY, barW, 7, 4); ctx.fill();
        if (cueProg > 0) {
          const bg = ctx.createLinearGradient(barX, 0, barX + barW, 0);
          bg.addColorStop(0,   '#a855f7');
          bg.addColorStop(0.5, '#facc15');
          bg.addColorStop(1,   '#f97316');
          ctx.fillStyle = bg;
          ctx.beginPath(); ctx.roundRect(barX, barY, barW * cueProg, 7, 4); ctx.fill();
        }
      }
    }
    } else {
    // ════════════════ MODO PÁGINAS DE 8 ════════════════
    if (cueList.length > 0) {
      let effectiveIdx = idx;
      if (effectiveIdx < 0) {
        const nextIdx = cueList.findIndex(c => c.start > t);
        effectiveIdx  = nextIdx >= 0 ? nextIdx : cueList.length - 1;
      }
      const WINDOW   = 8;
      const pageIdx  = Math.floor(effectiveIdx / WINDOW);
      const winStart = pageIdx * WINDOW;
      const winEnd   = Math.min(cueList.length, winStart + WINDOW);
      const winCues  = cueList.slice(winStart, winEnd);

      ctxLS.letterSpacing = '3px';

      type PageItem = { cue: Cue; ww: number; fs: number };
      const pageLines: PageItem[][] = [];
      let pLine: PageItem[] = [], pLineW = 0;
      for (const cue of winCues) {
        const fs = getWordFS(cue.text);
        ctx.font = `900 ${fs}px "Bebas Neue"`;
        const ww = ctx.measureText(cue.text + ' ').width;
        if (pLineW + ww > MAX_W && pLine.length > 0) {
          pageLines.push(pLine); pLine = [{ cue, ww, fs }]; pLineW = ww;
        } else { pLine.push({ cue, ww, fs }); pLineW += ww; }
      }
      if (pLine.length > 0) pageLines.push(pLine);

      const totH  = pageLines.length * LH;
      const stY   = H * 0.50 - totH / 2 + FS;
      const ENTRY_DUR_P = 0.28;

      pageLines.forEach((items, li) => {
        const align = ALIGNS[li % ALIGNS.length];
        const lw    = items.reduce((s, it) => s + it.ww, 0);
        let wx      = align === 'center' ? W / 2 - lw / 2 : align === 'left' ? MG : W - MG - lw;
        const lineY = stY + li * LH;

        items.forEach(({ cue, ww, fs }) => {
          const isActive    = t >= cue.start && t <= cue.end;
          const isCompleted = t > cue.end;
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;
          const ws = getWordStyle(cue.text);

          if (isActive) {
            const entryAge   = t - cue.start;
            const entryP     = Math.min(1, entryAge / ENTRY_DUR_P);
            const entrySc    = 0.18 + easeOutExpo(entryP) * 0.82;
            const entryAlpha = Math.min(1, entryP * 4);
            ctx.save();
            ctx.translate(wx + ww * 0.5, lineY);
            ctx.scale(entrySc, entrySc);
            ctx.globalAlpha = entryAlpha;
            ctxLS.letterSpacing = '0px';
            ctx.font        = `900 ${fs}px "Bebas Neue"`;
            ctx.textAlign   = 'left';
            ctx.strokeStyle = 'rgba(0,0,0,0.92)'; ctx.lineJoin = 'round'; ctx.lineWidth = fs * 0.04;
            const letters   = cue.text.split('');
            const wordW     = ctx.measureText(cue.text).width;
            const wScl      = 1.0 + Math.sin(t * 9.5) * 0.018;
            ctx.scale(wScl, wScl); let lx = -wordW / 2;
            letters.forEach((ch, ci) => {
              const cw   = ctx.measureText(ch).width;
              const wy   = Math.sin(t * 9 + ci * 1.5) * 5;
              const glow = (24 + Math.sin(t * 5.5 + ci * 0.9) * 13) * ws.glowMult;
              // fill+shadow primero → glow queda detrás del trazo
              ctx.shadowColor = ws.shadowColor; ctx.shadowBlur = glow;
              ctx.fillStyle = ws.activeColor; ctx.fillText(ch, lx, wy);
              // stroke encima sin sombra → borde limpio que tapa el glow interior
              ctx.shadowBlur = 0; ctx.strokeText(ch, lx, wy);
              lx += cw;
            });
            ctx.restore(); ctxLS.letterSpacing = '3px';
          } else if (isCompleted) {
            const age = t - cue.end;
            if (age < FLY_DUR) drawFlyThrough(cue.text, wx + ww / 2, lineY, age, fs);
          } else {
            ctx.font        = `900 ${fs}px "Bebas Neue"`;
            ctx.shadowColor = ws.upcomingColor;
            ctx.shadowBlur  = 8 * ws.upcomingAlpha;
            ctx.fillStyle   = ws.upcomingColor;
            ctx.globalAlpha = ws.upcomingAlpha;
            ctx.textAlign   = 'left';
            ctx.fillText(cue.text, wx, lineY);
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
          }
          wx += ww;
        });
      });

      if (curr) {
        const cueDur  = Math.max(curr.end - curr.start, 0.01);
        const cueProg = Math.min(1, (t - curr.start) / cueDur);
        const barY = H * 0.77, barW = W * 0.80, barX = W / 2 - barW / 2;
        ctx.fillStyle = '#1a4a28';
        ctx.beginPath(); ctx.roundRect(barX, barY, barW, 7, 4); ctx.fill();
        if (cueProg > 0) {
          const bg = ctx.createLinearGradient(barX, 0, barX + barW, 0);
          bg.addColorStop(0, '#a855f7'); bg.addColorStop(0.5, '#facc15'); bg.addColorStop(1, '#f97316');
          ctx.fillStyle = bg;
          ctx.beginPath(); ctx.roundRect(barX, barY, barW * cueProg, 7, 4); ctx.fill();
        }
      }
    }
    } // end mode branch

    // ── Gap indicator: barra que muestra el gap entre cues ────────────────
    if (!curr && cueList.length > 0) {
      const nextCue = cueList.find(c => c.start > t);
      if (nextCue) {
        // Encuentra el inicio del gap (fin del último cue completado)
        let gapStart = 0;
        for (let i = cueList.length - 1; i >= 0; i--) {
          if (cueList[i].end <= t) { gapStart = cueList[i].end; break; }
        }
        const gapDur = nextCue.start - gapStart;
        if (gapDur > 0.1) {
          const gapProg = Math.max(0, Math.min(1, (t - gapStart) / gapDur));
          const remaining = Math.max(0, nextCue.start - t);

          const barH = 54;
          const barW = W * 0.76;
          const barX = W / 2 - barW / 2;
          const barY = H * 0.86;

          // Track (opaque dark)
          ctx.fillStyle = '#0d1f0d';
          ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, barH / 2); ctx.fill();

          // Fill: progresa de azul oscuro → dorado mientras se acerca la palabra
          if (gapProg > 0) {
            const fillW = barW * gapProg;
            const grd   = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
            grd.addColorStop(0,   '#1e3a5f');
            grd.addColorStop(0.6, '#a855f7');
            grd.addColorStop(1,   '#facc15');
            ctx.fillStyle = grd;
            ctx.beginPath(); ctx.roundRect(barX, barY, fillW, barH, barH / 2); ctx.fill();
          }

          // Pulso en el extremo derecho de la barra cuando quedan < 0.8s
          if (remaining < 0.8 && gapProg > 0) {
            const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 6);
            const dotR  = barH * 0.55 + pulse * 4;
            const dotX  = barX + barW * gapProg;
            ctx.fillStyle = '#facc15';
            ctx.shadowColor = '#facc15';
            ctx.shadowBlur  = 18 + pulse * 10;
            ctx.beginPath(); ctx.arc(dotX, barY + barH / 2, dotR, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
          }

          // Tiempo restante y etiqueta
          ctx.font      = '400 28px "DM Sans"';
          ctx.fillStyle = '#888888';
          ctx.textAlign = 'right';
          ctx.fillText(remaining.toFixed(1) + 's', barX - 16, barY + barH * 0.78);

          ctx.textAlign = 'left';
          ctx.fillStyle = '#555555';
          ctx.fillText('GAP', barX + barW + 16, barY + barH * 0.78);
        }
      }
    }

    // ── Timeline ──────────────────────────────────────────────────────────
    const dur = aud.duration || 1;
    ctx.fillStyle = '#1a4a28';
    ctx.fillRect(0, H - 10, W, 10);
    const tlGrd = ctx.createLinearGradient(0, 0, W, 0);
    tlGrd.addColorStop(0,   '#a855f7');
    tlGrd.addColorStop(0.5, '#facc15');
    tlGrd.addColorStop(1,   '#f97316');
    ctx.fillStyle = tlGrd;
    ctx.fillRect(0, H - 10, W * (t / dur), 10);

    ctx.font      = '400 32px "DM Sans"';
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'right';
    ctx.fillText(fmt(t) + ' / ' + fmt(dur), W - 36, 58);

    // ── Glitch post-processing ─────────────────────────────────────────
    if (glitchEnabledRef.current) {
      // Auto-detección de picos de graves vía FFT
      if (analyserRef.current && freqDataRef.current) {
        analyserRef.current.getByteFrequencyData(freqDataRef.current);
        const fd   = freqDataRef.current;
        const kick = (fd[0] + fd[1] + fd[2] + fd[3] + fd[4]) / 5;
        if (kick > 205) {
          glitchRef.current = Math.min(1, glitchRef.current + (kick - 205) / 50 * 0.55);
        }
      }
      const g = glitchRef.current;
      glitchRef.current *= 0.87; // decae en ~15 frames
      if (g > 0.04) {
        // Snapshot pre-glitch como fuente para CA y screen tear
        if (!offCanvasRef.current) {
          const oc = document.createElement('canvas');
          oc.width = W; oc.height = H;
          offCanvasRef.current = oc;
        }
        offCanvasRef.current.getContext('2d')!.drawImage(canvas, 0, 0);
        if (glitchStyleRef.current === 'analog') {
          applyGlitch2(ctx, offCanvasRef.current, g);
        } else {
          applyGlitch(ctx, offCanvasRef.current, g);
        }
      }
    }

  }, []);

  // ── Animation loop ─────────────────────────────────────────────────────
  const cuesRef = useRef<Cue[]>([]);
  useEffect(() => { cuesRef.current = cues; }, [cues]);

  // ── Cleanup al desmontar ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      if (recRef.current?.state !== 'inactive') recRef.current?.stop();
      recRef.current = null;
      // No cerrar el AudioContext aquí: el <audio> queda vinculado al contexto
      // mediante MediaElementSource y no se puede reconectar a uno nuevo.
      // El GC lo libera cuando el componente se desmonta de verdad.
      audioCtxRef.current?.suspend();
      if (videoBlobUrlRef.current) URL.revokeObjectURL(videoBlobUrlRef.current);
      if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current);
      if (bgBlobUrlRef.current)    URL.revokeObjectURL(bgBlobUrlRef.current);
      offCanvasRef.current  = null;
      bgImageRef.current    = null;
      chunksRef.current     = [];
      particlesRef.current  = [];
      cueLayoutRef.current  = [];
    };
  }, []);

  const loop = useCallback(() => {
    const aud = audRef.current;
    if (!aud) return;
    const t   = aud.currentTime;
    drawFrame(t, cuesRef.current);
    const dur = aud.duration || 1;
    setProgress((t / dur) * 100);
    setTimeLabel(fmt(t) + ' / ' + fmt(dur));
    const idx = cuesRef.current.findIndex(c => t >= c.start && t <= c.end);
    setActiveCue(idx);
    animRef.current = requestAnimationFrame(loop);
  }, [drawFrame]);

  // scroll active cue into view
  useEffect(() => {
    if (!cueListRef.current) return;
    const el = cueListRef.current.querySelector('.kc-active') as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeCue]);

  // initial blank frame when ready — arranca con solo audio para poder probar glitch
  useEffect(() => {
    if (audioLoaded) {
      drawFrame(audRef.current?.currentTime ?? 0, cuesRef.current);
      animRef.current = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [audioLoaded, srtLoaded, loop, drawFrame]);

  // ── Audio graph (incluye analyser para glitch) ─────────────────────────
  function ensureAudioGraph() {
    const aud = audRef.current;
    if (!aud) return;
    // Si el contexto ya existe y está suspendido (p.ej. por el cleanup de Strict Mode),
    // simplemente lo reanudamos sin crear uno nuevo.
    if (audioCtxRef.current) {
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      return;
    }
    const actx          = new AudioContext();
    audioCtxRef.current = actx;
    audioDestRef.current = actx.createMediaStreamDestination();
    const analyser      = actx.createAnalyser();
    analyser.fftSize    = 512;
    analyser.smoothingTimeConstant = 0.80;
    analyserRef.current  = analyser;
    freqDataRef.current  = new Uint8Array(analyser.frequencyBinCount);
    const src = actx.createMediaElementSource(aud);
    src.connect(analyser);
    analyser.connect(audioDestRef.current);
    analyser.connect(actx.destination);
  }

  // ── Controls ───────────────────────────────────────────────────────────
  function togglePlay() {
    const aud = audRef.current;
    if (!aud) return;
    if (aud.paused) {
      ensureAudioGraph();
      audioCtxRef.current?.resume();
      aud.play().catch(() => {}); setPlaying(true);
    } else { aud.pause(); setPlaying(false); }
  }

  function triggerGlitch(intensity = 1) {
    glitchRef.current = Math.min(1, intensity);
  }

  function seekTo(e: React.MouseEvent<HTMLDivElement>) {
    const aud = audRef.current;
    if (!aud) return;
    const r = e.currentTarget.getBoundingClientRect();
    aud.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (aud.duration || 0);
  }

  // ── Recording ──────────────────────────────────────────────────────────
  async function startRecord(transparent = false) {
    const canvas = canvasRef.current;
    const aud    = audRef.current;
    if (!canvas || !aud) return;
    chunksRef.current = [];
    setBlobUrl(null);
    transparentRecRef.current = transparent;

    const canvasStream = canvas.captureStream(30);
    let combined: MediaStream;
    try {
      ensureAudioGraph();
      if (audioCtxRef.current?.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDestRef.current!.stream.getAudioTracks(),
      ]);
    } catch (err) {
      console.error('Audio capture setup failed:', err);
      combined = canvasStream;
    }

    // Modo transparente: forzar VP9 — único codec WebM que soporta canal alfa
    // Modo normal: preferir MP4 nativo para evitar conversión posterior
    const mimeType = transparent
      ? (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm')
      : MediaRecorder.isTypeSupported('video/mp4;codecs=h264,aac')  ? 'video/mp4;codecs=h264,aac'  :
        MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a') ? 'video/mp4;codecs=avc1,mp4a' :
        MediaRecorder.isTypeSupported('video/mp4')                  ? 'video/mp4'                  :
        MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' :
        MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' :
        'video/webm';

    const isNativeMp4 = !transparent && mimeType.startsWith('video/mp4');
    console.log(`[karaoke] Grabando con: ${mimeType} (${isNativeMp4 ? 'MP4 nativo ✅' : 'WebM, necesita conversión'}`);

    const rec = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 5_000_000 });
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      transparentRecRef.current = false;
      const blob   = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = []; // libera memoria de los chunks de video
      if (videoBlobUrlRef.current) URL.revokeObjectURL(videoBlobUrlRef.current);
      const newUrl = URL.createObjectURL(blob);
      videoBlobUrlRef.current = newUrl;
      setBlobUrl(newUrl);
      setRecording(false);
      setIsNativeMp4(isNativeMp4);
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

  function toggleRecord() {
    if (!recording) startRecord(false); else stopRecord();
  }

  function toggleTransparentRecord() {
    if (!recording) startRecord(true); else stopRecord();
  }

  function startSample() {
    startRecord();
    setTimeout(() => {
      stopRecord();
    }, 30_000);
  }

  function downloadVideo() {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = isTransparentRec ? 'karaoke-transparente.webm' : isNativeMp4 ? 'karaoke.mp4' : 'karaoke.webm';
    a.click();
  }

  async function downloadMp4() {
    if (!blobUrl || convertingMp4) return;
    setConvertingMp4(true);
    try {
      const blob    = await fetch(blobUrl).then(r => r.blob());
      if (blob.size > 80 * 1024 * 1024) {
        alert('El video pesa más de 80 MB. Descarga el archivo .webm e impórtalo en CapCut para exportar como MP4 para WhatsApp.');
        return;
      }
      const form    = new FormData();
      form.append('video', blob, isNativeMp4 ? 'karaoke.mp4' : 'karaoke.webm');
      const res     = await fetch('/api/convert-to-mp4', { method: 'POST', body: form });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let msg = '';
        try { msg = JSON.parse(text).error ?? ''; } catch { msg = text.slice(0, 200); }
        if (!msg) msg = `HTTP ${res.status}`;
        if (res.status === 413) msg = 'El video es demasiado grande para convertir en el servidor (límite 4.5 MB). Descarga el .webm y convierte con CapCut o Handbrake.';
        alert('Error al convertir: ' + msg);
        return;
      }
      const mp4Blob = await res.blob();
      const url     = URL.createObjectURL(mp4Blob);
      const a       = document.createElement('a');
      a.href = url; a.download = 'karaoke.mp4'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error de conexión al convertir a MP4. Intenta descargar el .webm e importarlo en CapCut.');
      console.error(err);
    } finally {
      setConvertingMp4(false);
    }
  }

  // ── File loaders ───────────────────────────────────────────────────────
  function onSrtChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = ev => {
      const parsed = parseSRT(ev.target?.result as string);
      setCues(parsed);
      cuesRef.current = parsed;
      setSrtName(f.name);
      setSrtLoaded(true);
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
    img.onload = () => {
      bgImageRef.current = img;
      setBgImage(img);
      setBgName(f.name);
    };
    img.src = url;
  }

  function removeBg() {
    bgImageRef.current = null;
    setBgImage(null);
    setBgName('');
  }

  function onAudioChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    audioFileRef.current = f;
    const aud = audRef.current;
    if (!aud) return;
    if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current);
    const url = URL.createObjectURL(f);
    audioBlobUrlRef.current = url;
    aud.src = url;
    aud.load();
    setAudioName(f.name);
    setAudioLoaded(true);
  }

  // ── Tap-sync functions ─────────────────────────────────────────────────
  function prepareLyrics() {
    const isInstruction = (l: string) => /^\[.*\]$|^\(.*\)$/.test(l);
    const lines = lyricsText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !isInstruction(l));
    setTapLines(lines);
    tapLinesRef.current = lines;
  }

  function startTapping() {
    const aud = audRef.current;
    if (!aud) return;
    tapTimestampsRef.current = [];
    tapEndsRef.current       = [];
    tapIdxRef.current = 0;
    setTapIdx(0);
    setTapLineStatus('waiting');
    tappingRef.current = true;
    setTapping(true);
    aud.currentTime = 0;
    aud.play().catch(() => {});
    setPlaying(true);
  }

  function registerTap() {
    const aud = audRef.current;
    if (!aud || !tappingRef.current) return;
    tapTimestampsRef.current.push(aud.currentTime);
    tapEndsRef.current.push(null);
    const newIdx = tapIdxRef.current + 1;
    tapIdxRef.current = newIdx;
    setTapIdx(newIdx);
    setTapLineStatus('started'); // línea activa → rojo
    // No auto-finalizar: el usuario debe presionar FIN en la última línea
  }

  function registerEnd() {
    const aud = audRef.current;
    if (!aud || !tappingRef.current) return;
    const lastIdx = tapIdxRef.current - 1;
    if (lastIdx < 0) return;
    tapEndsRef.current[lastIdx] = aud.currentTime;
    setTapLineStatus('ended'); // línea activa → azul
    // Si era la última línea, terminar automáticamente
    if (tapIdxRef.current >= tapLinesRef.current.length) {
      finishTapping();
    }
  }

  function finishTapping() {
    const aud = audRef.current;
    tappingRef.current = false;
    setTapping(false);
    aud?.pause();
    setPlaying(false);
    const lines = tapLinesRef.current;
    const ts    = tapTimestampsRef.current;
    const ends  = tapEndsRef.current;
    const dur   = aud?.duration || 0;
    const built: Cue[] = lines.map((text, i) => ({
      start: ts[i]   ?? 0,
      end:   ends[i] ?? ts[i + 1] ?? (dur > 0 ? dur : (ts[i] ?? 0) + 5),
      text,
    }));
    setCues(built);
    cuesRef.current = built;
    setSrtLoaded(true);
  }

  function resetTap() {
    setCues([]); cuesRef.current = [];
    setTapLines([]); tapLinesRef.current = [];
    setTapIdx(0); tapIdxRef.current = 0;
    tapTimestampsRef.current = [];
    tapEndsRef.current = [];
    tappingRef.current = false;
    setTapping(false);
    setSrtLoaded(false);
  }

  // Spacebar listener for tapping
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

  // ── Transcripción con Deepgram ─────────────────────────────────────────
  async function transcribeAudio() {
    const file = audioFileRef.current;
    if (!file) return;
    setTranscribing(true);
    setTranscribeError('');
    try {
      const form = new FormData();
      form.append('audio', file);
      const res  = await fetch('/api/transcribe', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al transcribir');
      const built: Cue[] = data.cues;
      setCues(built);
      cuesRef.current = built;
      setSrtLoaded(true);
    } catch (e) {
      setTranscribeError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setTranscribing(false);
    }
  }

  // ── Exportar SRT ───────────────────────────────────────────────────────
  function downloadSRT() {
    if (cues.length === 0) return;
    const pad = (n: number, d = 2) => String(n).padStart(d, '0');
    const toSRTTime = (s: number) => {
      const h  = Math.floor(s / 3600);
      const m  = Math.floor((s % 3600) / 60);
      const sc = Math.floor(s % 60);
      const ms = Math.round((s % 1) * 1000);
      return `${pad(h)}:${pad(m)}:${pad(sc)},${pad(ms, 3)}`;
    };
    const text = cues
      .map((c, i) => `${i + 1}\n${toSRTTime(c.start)} --> ${toSRTTime(c.end)}\n${c.text}`)
      .join('\n\n');
    const a = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = 'karaoke.srt';
    a.click();
  }

  const ready = audioLoaded && cues.length > 0;

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
        <h1 className="karaoke-title">KARAOKE<span>video recorder</span></h1>

        {/* File loaders */}
        <div className="kk-upload-row">

          {/* ── Letra / SRT ── */}
          <div className="kk-upload-block">
            {/* Mode toggle */}
            <div className="kk-mode-row">
              <button className={`kk-mode-btn${inputMode === 'tap' ? ' active' : ''}`} onClick={() => setInputMode('tap')}>✏️ Letra</button>
              <button className={`kk-mode-btn${inputMode === 'srt' ? ' active' : ''}`} onClick={() => setInputMode('srt')}>📄 SRT</button>
              <button className={`kk-mode-btn${inputMode === 'ai'  ? ' active' : ''}`} onClick={() => setInputMode('ai')}>🤖 IA</button>
            </div>

            {inputMode === 'srt' && (
              <>
                <label className="kk-label">Archivo SRT</label>
                <button className={`kk-drop${srtLoaded ? ' loaded' : ''}`} onClick={() => document.getElementById('srt-in')?.click()}>
                  {srtLoaded ? `✅ ${srtName}` : '📄 Seleccionar .srt'}
                </button>
                <input type="file" id="srt-in" accept=".srt" style={{ display: 'none' }} onChange={onSrtChange} />
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
                {transcribing && (
                  <p className="kk-tap-info" style={{ color: '#facc15' }}>
                    ⏳ Transcribiendo… puede tardar unos segundos
                  </p>
                )}
                {transcribeError && (
                  <p className="kk-tap-info" style={{ color: '#ff4444' }}>⚠ {transcribeError}</p>
                )}
                {cues.length > 0 && !transcribing && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p className="kk-tap-info">✅ {cues.length} palabras detectadas</p>
                    <button className="kk-btn primary" onClick={transcribeAudio} disabled={!audioLoaded}>
                      🔄 Re-transcribir
                    </button>
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

                {/* Línea activa (arriba, pequeña, coloreada) */}
                {tapIdx > 0 && (
                  <div className={`kk-tap-active-line kk-tap-line--${tapLineStatus}`}>
                    {tapLines[tapIdx - 1]}
                  </div>
                )}

                {/* Línea próxima (principal, grande, blanca — la que vas a tapear) */}
                {tapIdx < tapLines.length ? (
                  <div className="kk-tap-line kk-tap-line--ready">
                    {tapLines[tapIdx]}
                  </div>
                ) : (
                  <div className="kk-tap-line kk-tap-line--waiting" style={{ fontSize: 15, opacity: 0.7 }}>
                    ← Presiona <kbd>Enter</kbd> / FIN para terminar
                  </div>
                )}

                <div className="kk-tap-btns">
                  <button className="kk-tap-btn" onClick={registerTap} disabled={tapIdx >= tapLines.length}>TAP</button>
                  <button className="kk-end-btn" onClick={registerEnd} disabled={tapIdx === 0}>FIN</button>
                </div>
                <p className="kk-tap-hint"><kbd>Espacio</kbd> = inicio de línea &nbsp;·&nbsp; <kbd>Enter</kbd> = fin de línea</p>
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
            <button className={`kk-drop${audioLoaded ? ' loaded' : ''}`} onClick={() => document.getElementById('audio-in')?.click()}>
              {audioLoaded ? `✅ ${audioName}` : '🎵 Seleccionar audio'}
            </button>
            <input type="file" id="audio-in" accept="audio/*" style={{ display: 'none' }} onChange={onAudioChange} />
          </div>
          <div className="kk-upload-block">
            <label className="kk-label">Fondo (jpg, png…) — opcional</label>
            <button className={`kk-drop${bgImage ? ' loaded' : ''}`} onClick={() => document.getElementById('bg-in')?.click()}>
              {bgImage ? `✅ ${bgName}` : '🖼 Seleccionar imagen'}
            </button>
            {bgImage && (
              <button className="kk-drop" style={{ marginTop: 6, fontSize: 12 }} onClick={removeBg}>
                ✕ Quitar imagen (usar chroma)
              </button>
            )}
            <input type="file" id="bg-in" accept="image/*" style={{ display: 'none' }} onChange={onBgChange} />
          </div>
        </div>

        {/* Canvas */}
        <div className="kk-stage-wrap">
          <canvas ref={canvasRef} width={canvasDims.w} height={canvasDims.h} />
        </div>

        {/* Format toggle */}
        <div className="kk-mode-row" style={{ marginBottom: 4 }}>
          <button
            className={`kk-mode-btn${format === '9:16' ? ' active' : ''}`}
            onClick={() => setFormat('9:16')}
            disabled={recording}
          >
            📱 9:16 Vertical
          </button>
          <button
            className={`kk-mode-btn${format === '16:9' ? ' active' : ''}`}
            onClick={() => setFormat('16:9')}
            disabled={recording}
          >
            🖥 16:9 Horizontal
          </button>
        </div>

        {/* Display mode toggle */}
        <div className="kk-mode-row" style={{ marginBottom: 4 }}>
          <button
            className={`kk-mode-btn${displayMode === 'scroll' ? ' active' : ''}`}
            onClick={() => { displayModeRef.current = 'scroll'; setDisplayMode('scroll'); scrollYRef.current = 0; }}
          >
            ↕ Scroll continuo
          </button>
          <button
            className={`kk-mode-btn${displayMode === 'page' ? ' active' : ''}`}
            onClick={() => { displayModeRef.current = 'page'; setDisplayMode('page'); }}
          >
            ▦ Páginas de 8
          </button>
        </div>

        {/* Glitch controls */}
        <div className="kk-mode-row" style={{ marginBottom: 8 }}>
          <button
            className={`kk-mode-btn${glitchEnabled ? ' active' : ''}`}
            onClick={() => { glitchEnabledRef.current = !glitchEnabled; setGlitchEnabled(g => !g); }}
          >
            ⚡ Glitch {glitchEnabled ? 'ON' : 'OFF'}
          </button>
          <button
            className={`kk-mode-btn${glitchStyle === 'digital' ? ' active' : ''}`}
            onClick={() => { glitchStyleRef.current = 'digital'; setGlitchStyle('digital'); }}
            disabled={!glitchEnabled}
            title="Digital: row shifts aleatorios + chromatic aberration + noise"
          >
            📺 Digital
          </button>
          <button
            className={`kk-mode-btn${glitchStyle === 'analog' ? ' active' : ''}`}
            onClick={() => { glitchStyleRef.current = 'analog'; setGlitchStyle('analog'); }}
            disabled={!glitchEnabled}
            title="VHS: pixel sort por brillo + onda seno + inversión + tracking lines"
          >
            📼 VHS
          </button>
          <button
            className="kk-mode-btn"
            onClick={() => triggerGlitch(1)}
            disabled={!glitchEnabled || !audioLoaded}
            title="Dispara el efecto glitch máximo (simula un drop)"
          >
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
          <button className={`kk-btn ${recording ? 'danger' : 'rec'}`} onClick={toggleTransparentRecord} disabled={!ready} title="Graba sin fondo verde — importa directo en CapCut sin chroma key">
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
                ⬇ {isTransparentRec ? 'Descargar transparente .webm' : isNativeMp4 ? 'Descargar .mp4' : 'Descargar .webm'}
              </button>
              <button className="kk-btn primary" onClick={downloadMp4} disabled={convertingMp4}>
                {convertingMp4 ? '⏳ Convirtiendo…' : '📱 Para WhatsApp'}
              </button>
            </>
          )}
        </div>


        <div className="kk-info">
          <strong>Instrucciones:</strong> Carga tu <strong>.srt</strong> y tu <strong>audio</strong> → presiona <strong>Grabar video</strong> → el karaoke corre solo y graba todo → al terminar descarga el video.<br />
          En Chrome/Edge el video se graba directamente como <strong>.mp4</strong>. En otros navegadores se graba como <strong>.webm</strong> (compatible con CapCut, DaVinci Resolve, Premiere).<br />
          Usa <strong>📱 Para WhatsApp</strong> para obtener un MP4 con perfil H.264 Baseline compatible con WhatsApp (re-encoda en el servidor).<br /><br />
          <strong>Tip:</strong> Para mejor calidad usa Chrome o Edge. El video se graba a 1280×720.
        </div>
      </div>

      <audio ref={audRef} onEnded={() => { if (recording) stopRecord(); setPlaying(false); }} />
    </div>
  );
}
