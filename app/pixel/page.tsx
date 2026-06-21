'use client';
import { useState, useRef } from 'react';

const COLS = 64;
const ROWS = 100;
const PX_SCREEN = 10;
const CM_PX = 38;

const FIXED_PALETTE: RGB[] = [
  [0x24, 0x24, 0x24],
  [0x3f, 0x40, 0x3f],
  [0x5d, 0x5d, 0x5d],
  [0x7b, 0x79, 0x7b],
  [0x98, 0x98, 0x97],
  [0xb7, 0xb7, 0xb9],
  [0xd8, 0xd8, 0xd9],
  [0xfc, 0xfc, 0xfc],
];
const NUM_COLORS = FIXED_PALETTE.length;

type RGB = [number, number, number];
type LAB = [number, number, number];

// RGB <-> LAB conversion (perceptually uniform)
function rgbToLab(rgb: RGB): LAB {
  let r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
  r = r > 0.04045 ? ((r + 0.055) / 1.055) ** 2.4 : r / 12.92;
  g = g > 0.04045 ? ((g + 0.055) / 1.055) ** 2.4 : g / 12.92;
  b = b > 0.04045 ? ((b + 0.055) / 1.055) ** 2.4 : b / 12.92;
  let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  let y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) / 1.00000;
  let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;
  const f = (t: number) => t > 0.008856 ? t ** (1/3) : 7.787 * t + 16/116;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function labToRgb(lab: LAB): RGB {
  const fy = (lab[0] + 16) / 116;
  const fx = lab[1] / 500 + fy;
  const fz = fy - lab[2] / 200;
  const f = (t: number) => t > 0.2069 ? t ** 3 : (t - 16/116) / 7.787;
  let r =  3.2404542 * f(fx) * 0.95047 - 1.5371385 * f(fy) - 0.4985314 * f(fz) * 1.08883;
  let g = -0.9692660 * f(fx) * 0.95047 + 1.8760108 * f(fy) + 0.0415560 * f(fz) * 1.08883;
  let b =  0.0556434 * f(fx) * 0.95047 - 0.2040259 * f(fy) + 1.0572252 * f(fz) * 1.08883;
  const toSrgb = (c: number) => Math.round(Math.max(0, Math.min(255, (c > 0.0031308 ? 1.055 * c ** (1/2.4) - 0.055 : 12.92 * c) * 255)));
  return [toSrgb(r), toSrgb(g), toSrgb(b)];
}

function labDist(a: LAB, b: LAB): number {
  return (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2;
}

// ΔE distance (perceptual, in LAB units — values > 20 are clearly different colors)
function deltaE(a: LAB, b: LAB): number {
  return Math.sqrt(labDist(a, b));
}

function kMeans(pixels: RGB[], k: number): RGB[] {
  const labPixels = pixels.map(rgbToLab);
  let bestCentroids: LAB[] = [];
  let bestDistortion = Infinity;

  for (let run = 0; run < 6; run++) {
    // k-means++ initialization in LAB space
    const centroids: LAB[] = [];
    centroids.push([...labPixels[Math.floor(Math.random() * labPixels.length)]] as LAB);
    while (centroids.length < k) {
      const dists = labPixels.map(p => Math.min(...centroids.map(c => labDist(p, c))));
      const total = dists.reduce((s, d) => s + d, 0);
      let r = Math.random() * total;
      for (let i = 0; i < labPixels.length; i++) {
        r -= dists[i];
        if (r <= 0) { centroids.push([...labPixels[i]] as LAB); break; }
      }
      if (centroids.length < k) centroids.push([...labPixels[Math.floor(Math.random() * labPixels.length)]] as LAB);
    }

    for (let iter = 0; iter < 30; iter++) {
      const sums: [number, number, number, number][] = Array.from({ length: k }, () => [0, 0, 0, 0]);
      for (const px of labPixels) {
        let minD = Infinity, minI = 0;
        for (let i = 0; i < k; i++) { const d = labDist(px, centroids[i]); if (d < minD) { minD = d; minI = i; } }
        sums[minI][0] += px[0]; sums[minI][1] += px[1]; sums[minI][2] += px[2]; sums[minI][3]++;
      }
      let changed = false;
      for (let i = 0; i < k; i++) {
        if (sums[i][3] === 0) continue;
        const nc: LAB = [sums[i][0]/sums[i][3], sums[i][1]/sums[i][3], sums[i][2]/sums[i][3]];
        if (labDist(nc, centroids[i]) > 0.01) changed = true;
        centroids[i] = nc;
      }
      if (!changed) break;
    }

    const distortion = labPixels.reduce((s, px) => s + Math.min(...centroids.map(c => labDist(px, c))), 0);
    if (distortion < bestDistortion) { bestDistortion = distortion; bestCentroids = centroids.map(c => [...c] as LAB); }
  }

  // Post-process: merge colors that are too similar (ΔE < 18) and replace with next best
  const MIN_DE = 18;
  for (let i = 0; i < bestCentroids.length; i++) {
    for (let j = i + 1; j < bestCentroids.length; j++) {
      if (deltaE(bestCentroids[i], bestCentroids[j]) < MIN_DE) {
        // Merge j into i (keep i), find replacement for j as the pixel farthest from all remaining centroids
        const remaining = bestCentroids.filter((_, idx) => idx !== j);
        let maxDist = -1, bestPx: LAB = labPixels[0];
        for (const px of labPixels) {
          const d = Math.min(...remaining.map(c => labDist(px, c)));
          if (d > maxDist) { maxDist = d; bestPx = px; }
        }
        bestCentroids[j] = bestPx;
      }
    }
  }

  return bestCentroids.map(labToRgb);
}

function toHex(c: RGB) { return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); }
function luminance(c: RGB) { return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }

function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawPin(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, color: RGB) {
  const [r, g, b] = color;

  // Drop shadow (offset, no blur)
  ctx.save();
  ctx.globalAlpha = 0.40;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(cx + R * 0.13, cy + R * 0.20, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── Flat disc: uniform base colour ──────────────────────────
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fill();

  // Subtle directional shading — LINEAR only, very low opacity
  // (light from above-left hitting a flat surface, not a sphere)
  const sh = ctx.createLinearGradient(cx - R * 0.5, cy - R, cx + R * 0.5, cy + R);
  sh.addColorStop(0,   'rgba(255,255,255,0.18)');
  sh.addColorStop(0.45,'rgba(128,128,128,0)');
  sh.addColorStop(1,   'rgba(0,0,0,0.15)');
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = sh;
  ctx.fill();

  // Narrow edge ring — starts at 88% of radius so only the outer 12% darkens.
  // This defines the disc boundary without creating a sphere vignette.
  const edge = ctx.createRadialGradient(cx, cy, R * 0.88, cx, cy, R);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = edge;
  ctx.fill();

  // Tiny centre pin-hole
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fill();
}

function drawCeramicTile(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: RGB) {
  const [r, g, b] = color;
  const up = (n: number, a: number) => Math.min(255, n + a);
  const dn = (n: number, a: number) => Math.max(0,   n - a);
  const bv = Math.max(2, Math.round(size * 0.10));

  // Base colour
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(x, y, size, size);

  // Top highlight bevel (bright → base)
  const tg = ctx.createLinearGradient(x, y, x, y + bv);
  tg.addColorStop(0, `rgb(${up(r,55)},${up(g,55)},${up(b,55)})`);
  tg.addColorStop(1, `rgb(${r},${g},${b})`);
  ctx.fillStyle = tg;
  ctx.fillRect(x, y, size, bv);

  // Left highlight bevel
  const lg = ctx.createLinearGradient(x, y, x + bv, y);
  lg.addColorStop(0, `rgb(${up(r,38)},${up(g,38)},${up(b,38)})`);
  lg.addColorStop(1, `rgb(${r},${g},${b})`);
  ctx.fillStyle = lg;
  ctx.fillRect(x, y + bv, bv, size - bv * 2);

  // Bottom shadow bevel (base → dark)
  const btg = ctx.createLinearGradient(x, y + size - bv, x, y + size);
  btg.addColorStop(0, `rgb(${r},${g},${b})`);
  btg.addColorStop(1, `rgb(${dn(r,55)},${dn(g,55)},${dn(b,55)})`);
  ctx.fillStyle = btg;
  ctx.fillRect(x, y + size - bv, size, bv);

  // Right shadow bevel
  const rg = ctx.createLinearGradient(x + size - bv, y, x + size, y);
  rg.addColorStop(0, `rgb(${r},${g},${b})`);
  rg.addColorStop(1, `rgb(${dn(r,45)},${dn(g,45)},${dn(b,45)})`);
  ctx.fillStyle = rg;
  ctx.fillRect(x + size - bv, y + bv, bv, size - bv * 2);

  // Gloss sheen — diagonal linear (no sphere illusion)
  const gl = ctx.createLinearGradient(x, y, x + size * 0.72, y + size * 0.72);
  gl.addColorStop(0,    'rgba(255,255,255,0.30)');
  gl.addColorStop(0.40, 'rgba(255,255,255,0.07)');
  gl.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(x, y, size, size);
}

function drawFoamiBrick(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: RGB) {
  const [r, g, b] = color;
  const bulge = Math.max(1, Math.round(size * 0.09));

  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x, y + bulge);
    ctx.quadraticCurveTo(x + size / 2, y - bulge, x + size, y + bulge);
    ctx.lineTo(x + size, y + size - bulge);
    ctx.quadraticCurveTo(x + size / 2, y + size + bulge, x, y + size - bulge);
    ctx.closePath();
  };

  ctx.save();
  path();
  ctx.clip();

  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(x, y - bulge, size, size + bulge * 2);

  // Top highlight from convex surface
  const tg = ctx.createLinearGradient(x, y - bulge, x, y + size * 0.45);
  tg.addColorStop(0,   'rgba(255,255,255,0.30)');
  tg.addColorStop(0.5, 'rgba(255,255,255,0.07)');
  tg.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = tg;
  ctx.fillRect(x, y - bulge, size, size + bulge * 2);

  // Bottom shadow from convex surface
  const bg = ctx.createLinearGradient(x, y + size * 0.55, x, y + size + bulge);
  bg.addColorStop(0, 'rgba(0,0,0,0)');
  bg.addColorStop(1, 'rgba(0,0,0,0.24)');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y - bulge, size, size + bulge * 2);

  // Soft center glow (foam sponge look)
  const cg = ctx.createRadialGradient(x + size * 0.5, y + size * 0.36, 0, x + size * 0.5, y + size * 0.5, size * 0.55);
  cg.addColorStop(0, 'rgba(255,255,255,0.12)');
  cg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cg;
  ctx.fillRect(x, y - bulge, size, size + bulge * 2);

  // Side edge vignette
  const eg = ctx.createLinearGradient(x, 0, x + size, 0);
  eg.addColorStop(0,    'rgba(0,0,0,0.14)');
  eg.addColorStop(0.18, 'rgba(0,0,0,0)');
  eg.addColorStop(0.82, 'rgba(0,0,0,0)');
  eg.addColorStop(1,    'rgba(0,0,0,0.14)');
  ctx.fillStyle = eg;
  ctx.fillRect(x, y - bulge, size, size + bulge * 2);

  ctx.restore();
}

function drawLegoBrick(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: RGB) {
  const [r, g, b] = color;
  const up = (n: number, a: number) => Math.min(255, n + a);
  const dn = (n: number, a: number) => Math.max(0,   n - a);
  const bv = Math.max(2, Math.round(size * 0.09));

  // Brick face
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(x, y, size, size);

  // Top highlight bevel
  const tg = ctx.createLinearGradient(x, y, x, y + bv * 2);
  tg.addColorStop(0, `rgb(${up(r,50)},${up(g,50)},${up(b,50)})`);
  tg.addColorStop(1, `rgb(${r},${g},${b})`);
  ctx.fillStyle = tg; ctx.fillRect(x, y, size, bv);

  // Left highlight bevel
  const lg = ctx.createLinearGradient(x, y, x + bv, y);
  lg.addColorStop(0, `rgb(${up(r,35)},${up(g,35)},${up(b,35)})`);
  lg.addColorStop(1, `rgb(${r},${g},${b})`);
  ctx.fillStyle = lg; ctx.fillRect(x, y + bv, bv, size - bv * 2);

  // Bottom shadow bevel
  const btg = ctx.createLinearGradient(x, y + size - bv, x, y + size);
  btg.addColorStop(0, `rgb(${r},${g},${b})`);
  btg.addColorStop(1, `rgb(${dn(r,55)},${dn(g,55)},${dn(b,55)})`);
  ctx.fillStyle = btg; ctx.fillRect(x, y + size - bv, size, bv);

  // Right shadow bevel
  const rg = ctx.createLinearGradient(x + size - bv, y, x + size, y);
  rg.addColorStop(0, `rgb(${r},${g},${b})`);
  rg.addColorStop(1, `rgb(${dn(r,45)},${dn(g,45)},${dn(b,45)})`);
  ctx.fillStyle = rg; ctx.fillRect(x + size - bv, y, bv, size - bv * 2);

  // ── Stud (cylindrical peg) ───────────────────────────────────
  const cx = x + size / 2;
  const cy = y + size / 2;
  const sr = size * 0.30;

  // Stud base (slightly lighter than brick)
  ctx.beginPath(); ctx.arc(cx, cy, sr, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${up(r,12)},${up(g,12)},${up(b,12)})`; ctx.fill();

  // Cylindrical shading — linear left-to-right across stud
  const sg = ctx.createLinearGradient(cx - sr, cy, cx + sr, cy);
  sg.addColorStop(0,    `rgb(${up(r,55)},${up(g,55)},${up(b,55)})`);
  sg.addColorStop(0.30, `rgb(${up(r,22)},${up(g,22)},${up(b,22)})`);
  sg.addColorStop(0.60, `rgb(${r},${g},${b})`);
  sg.addColorStop(1,    `rgb(${dn(r,50)},${dn(g,50)},${dn(b,50)})`);
  ctx.beginPath(); ctx.arc(cx, cy, sr, 0, Math.PI * 2);
  ctx.fillStyle = sg; ctx.fill();

  // Bottom shadow crescent on stud (depth)
  const shad = ctx.createRadialGradient(cx, cy + sr * 0.3, 0, cx, cy, sr);
  shad.addColorStop(0.5, 'rgba(0,0,0,0)');
  shad.addColorStop(1,   'rgba(0,0,0,0.40)');
  ctx.beginPath(); ctx.arc(cx, cy, sr, 0, Math.PI * 2);
  ctx.fillStyle = shad; ctx.fill();

  // Top-left specular highlight
  ctx.beginPath();
  ctx.arc(cx - sr * 0.28, cy - sr * 0.28, sr * 0.30, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.38)'; ctx.fill();
}

// -1 = background (transparent)
type Grid = number[];

export default function PixelPage() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<'idle' | 'removing' | 'processing' | 'done' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [pixelGrid, setPixelGrid] = useState<Grid>([]);
  const [palette, setPalette] = useState<RGB[]>([]);
  const [counts, setCounts] = useState<number[]>([]);
  const [fileName, setFileName] = useState('');
  const [removeBg, setRemoveBg] = useState(false);
  const [groutColor, setGroutColor] = useState<'negro' | 'gris' | 'blanco'>('gris');

  async function processImage(file: File) {
    setFileName(file.name);
    if (removeBg) {
      setPhase('removing');
      setStatusMsg('Eliminando fondo… (primera vez descarga el modelo ~40 MB)');
    } else {
      setPhase('processing');
      setStatusMsg('Procesando imagen…');
    }

    let sourceBlob: Blob | null = null;

    if (removeBg) {
      try {
        const { removeBackground } = await import('@imgly/background-removal');
        sourceBlob = await removeBackground(file, {
          publicPath: `https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/`,
          output: { format: 'image/png', quality: 1 },
        });
        setStatusMsg('Cuantizando colores…');
      } catch (err) {
        console.error('[background-removal]', err);
        setStatusMsg('Error al eliminar fondo, procesando imagen completa…');
      }
    }

    setPhase('processing');

    // If background removal failed, use original but treat it as fully opaque
    const url = URL.createObjectURL(sourceBlob ?? file);
    const bgRemoved = sourceBlob !== null;

    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = COLS; c.height = ROWS;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, COLS, ROWS);
      ctx.drawImage(img, 0, 0, COLS, ROWS);
      const data = ctx.getImageData(0, 0, COLS, ROWS).data;
      URL.revokeObjectURL(url);

      // Subject pixels: alpha > 128 when bg removed, all pixels if bg removal failed
      const subjectPixels: RGB[] = [];
      const alphaMap: boolean[] = [];
      for (let i = 0; i < COLS * ROWS; i++) {
        const a = data[i * 4 + 3];
        const isSubject = bgRemoved ? a > 128 : true;
        if (isSubject) {
          subjectPixels.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
          alphaMap.push(true);
        } else {
          alphaMap.push(false);
        }
      }

      if (subjectPixels.length === 0) {
        setPhase('error');
        setStatusMsg('No se encontró sujeto en la imagen.');
        return;
      }

      // K-means ONLY on subject pixels — background never influences the palette
      const pal = FIXED_PALETTE;

      // Build full grid: -1 for background, palette index for subject
      const grid: Grid = [];
      let subIdx = 0;
      for (let i = 0; i < COLS * ROWS; i++) {
        if (!alphaMap[i]) { grid.push(-1); continue; }
        const px = subjectPixels[subIdx++];
        let minD = Infinity, minI = 0;
        const pxLab = rgbToLab(px);
        for (let j = 0; j < pal.length; j++) { const d = labDist(pxLab, rgbToLab(pal[j])); if (d < minD) { minD = d; minI = j; } }
        grid.push(minI);
      }

      // Count (only subject pixels)
      const cnt = Array(NUM_COLORS).fill(0);
      grid.forEach(i => { if (i >= 0) cnt[i]++; });

      // Palette is already ordered dark→light, no re-sort needed
      setPalette(pal);
      setPixelGrid(grid);
      setCounts(cnt);
      setPhase('done');
    };
    img.src = url;
  }

  function downloadGuide() {
    const swatch = (hex: string, num: number) => {
      const lum = palette[num - 1] ? luminance(palette[num - 1]) : 128;
      const txtColor = lum > 128 ? '#000' : '#fff';
      return `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;background:${hex};border:1px solid rgba(0,0,0,0.2);border-radius:3px;flex-shrink:0;font-size:11px;font-weight:900;color:${txtColor};font-family:monospace">${num}</span>`;
    };

    const paletteHtml = palette.map((c, i) => {
      const hex = toHex(c);
      const pct = ((counts[i] / subjectTotal) * 100).toFixed(1);
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        ${swatch(hex, i + 1)}
        <span style="font-family:monospace;font-size:13px;font-weight:700">${hex}</span>
        <span style="color:#666;font-size:12px">— ${counts[i]} px (${pct}%)</span>
      </div>`;
    }).join('');

    const rowsHtml = Array.from({ length: ROWS }, (_, row) => {
      const rowPixels = pixelGrid.slice(row * COLS, (row + 1) * COLS);
      const hasSubject = rowPixels.some(i => i >= 0);
      const squaresHtml = rowPixels.map(idx => {
        if (idx === -1) return `<span class="px-square" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:1px solid #e0e0e0;background:#fff;flex-shrink:0;border-radius:2px"></span>`;
        const hex = toHex(palette[idx]);
        const txtColor = luminance(palette[idx]) > 128 ? '#000' : '#fff';
        return `<span class="px-square" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;background:${hex};border:1px solid rgba(0,0,0,0.15);border-radius:2px;flex-shrink:0;font-size:10px;font-weight:900;color:${txtColor};font-family:monospace">${idx + 1}</span>`;
      }).join('');

      const bg = row % 2 === 0 ? '#fafafa' : '#f0f0f0';
      return `<tr style="background:${bg};height:16px;line-height:1">
        <td style="padding:0 8px;font-weight:700;font-size:11px;color:#555;white-space:nowrap;border-right:1px solid #ddd;vertical-align:middle;height:16px">Línea ${String(row + 1).padStart(3, '0')}</td>
        <td style="padding:0 4px;white-space:nowrap;height:16px;vertical-align:middle">${hasSubject ? `<div style="display:flex;flex-wrap:nowrap;gap:0px;align-items:center;line-height:0">${squaresHtml}</div>` : '<span style="color:#bbb;font-size:11px">vacía</span>'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Guía Pixel Art ${COLS}×${ROWS}</title>
<style>
  body { font-family: sans-serif; margin: 40px 20px; color: #333; }
  .table-wrap { overflow-x: auto; }
  table { border-collapse: collapse; white-space: nowrap; border-spacing: 0; }
  tr { height: 16px; line-height: 1; }
  td { padding: 0; }
  h1 { font-size: 1.3rem; margin: 0 0 4px; }
  h2 { font-size: 1rem; margin: 16px 0 6px; color: #555; }
  .print-btn {
    display: inline-block; margin-bottom: 16px; padding: 8px 20px;
    background: #333; color: #fff; border: none; border-radius: 6px;
    font-size: 14px; cursor: pointer; font-family: sans-serif;
  }
  @media print {
    .print-btn { display: none; }
    body { margin: 0; }
    .table-wrap { overflow: visible; }
  }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨 Imprimir / Guardar como PDF</button>
  <h1>Guía de colores — ${COLS}×${ROWS} px · ${NUM_COLORS} colores</h1>
  <p style="color:#888;font-size:13px;margin:0 0 12px">Cada línea = 1 fila de píxeles</p>
  <h2>Paleta</h2>
  ${paletteHtml}
  <h2>Líneas</h2>
  <div class="table-wrap"><table><tbody>${rowsHtml}</tbody></table></div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pixel_art_guia.html';
    a.click();
  }

  function downloadImage() {
    const c = document.createElement('canvas');
    c.width = COLS * CM_PX;
    c.height = ROWS * CM_PX;
    const ctx = c.getContext('2d')!;
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = pixelGrid[row * COLS + col];
        if (idx === -1) continue; // leave white
        const [r, g, b] = palette[idx];
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(col * CM_PX, row * CM_PX, CM_PX, CM_PX);
      }
    }
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = 'pixel_art.png';
    a.click();
  }

  function downloadPushPin() {
    const OW = 2048, OH = 3200;
    const cv = document.createElement('canvas');
    cv.width = OW; cv.height = OH;
    const ctx = cv.getContext('2d')!;

    // ── Black background ─────────────────────────────────────────
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, OW, OH);

    // ── Cork inner corners ────────────────────────────────────────
    // Horizontal span scaled to match vertical so cells are square (1 cm²):
    //   vertical  : 2890 px / 100 rows = 28.9 px / row
    //   horizontal: 1864 px /  64 cols = 29.1 px / col  ← matched
    const TL = { x:  98, y: 132 };
    const TR = { x: 1962, y: 168 };
    const BR = { x: 1920, y: 3058 };
    const BL = { x:  83, y: 3022 };

    // Thin dark frame around cork
    const FW = 52;
    const OTL = { x: TL.x - FW,        y: TL.y - FW        };
    const OTR = { x: TR.x + FW * 0.65, y: TR.y - FW        };
    const OBR = { x: BR.x + FW * 0.65, y: BR.y + FW        };
    const OBL = { x: BL.x - FW,        y: BL.y + FW        };

    // Left depth face of frame
    const DW = 26;
    const dTL = { x: OTL.x - DW,        y: OTL.y + DW * 0.5  };
    const dBL = { x: OBL.x - DW * 0.8,  y: OBL.y + DW * 0.6  };
    ctx.beginPath();
    ctx.moveTo(OTL.x, OTL.y); ctx.lineTo(OBL.x, OBL.y);
    ctx.lineTo(dBL.x, dBL.y); ctx.lineTo(dTL.x, dTL.y);
    ctx.closePath();
    ctx.fillStyle = '#141414';
    ctx.fill();

    // ── Cork base fill ───────────────────────────────────────────
    const corkPath = () => {
      ctx.beginPath();
      ctx.moveTo(TL.x, TL.y); ctx.lineTo(TR.x, TR.y);
      ctx.lineTo(BR.x, BR.y); ctx.lineTo(BL.x, BL.y);
      ctx.closePath();
    };
    corkPath();
    ctx.fillStyle = '#a86624';
    ctx.fill();

    // ── Realistic cork cellular texture ─────────────────────────
    ctx.save();
    corkPath();
    ctx.clip();

    const rng = mulberry32(54321);

    // Large warm variation patches (ambient light/shadow on cork surface)
    for (let i = 0; i < 35; i++) {
      const px = rng() * OW, py = rng() * OH;
      const rad = 180 + rng() * 320;
      const gr = ctx.createRadialGradient(px, py, 0, px, py, rad);
      const isLight = rng() > 0.42;
      gr.addColorStop(0, isLight
        ? `rgba(205,138,55,${0.14 + rng() * 0.16})`
        : `rgba(65, 28,  5,${0.10 + rng() * 0.13})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }

    // Cork cells — jittered grid, batched by brightness tier
    const CS = 9; // cell spacing px
    const corkTones = [
      'rgba(225,148,58,0.88)',   // bright highlight cell
      'rgba(188,114,40,0.82)',   // light
      'rgba(150, 82,22,0.75)',   // mid
      'rgba(108, 50,10,0.70)',   // dark
      'rgba( 65, 26, 4,0.65)',   // very dark cell / gap
    ];
    const buckets: Array<Array<[number, number, number]>> = corkTones.map(() => []);

    for (let cy2 = -CS; cy2 < OH + CS; cy2 += CS * 0.78) {
      for (let cx2 = -CS; cx2 < OW + CS; cx2 += CS * 0.88) {
        const jx = cx2 + (rng() - 0.5) * CS * 0.95;
        const jy = cy2 + (rng() - 0.5) * CS * 0.95;
        const r  = 1.8 + rng() * 4.2;
        const sh = rng();
        const bi = sh > 0.84 ? 0 : sh > 0.65 ? 1 : sh > 0.4 ? 2 : sh > 0.18 ? 3 : 4;
        buckets[bi].push([jx, jy, r]);
      }
    }
    for (let bi = 0; bi < corkTones.length; bi++) {
      ctx.fillStyle = corkTones[bi];
      ctx.beginPath();
      for (const [x, y, r] of buckets[bi]) {
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    // Fine horizontal grain lines
    for (let fy = 0; fy < OH; fy += 2) {
      if (rng() > 0.38) continue;
      ctx.globalAlpha = 0.04 + rng() * 0.05;
      ctx.strokeStyle = rng() > 0.5 ? '#7a3a10' : '#cf7e2e';
      ctx.lineWidth = rng() < 0.12 ? 1.5 : 0.7;
      ctx.beginPath();
      let fpx = 0, fpy = fy;
      ctx.moveTo(fpx, fpy);
      while (fpx < OW) { fpx += 8 + rng() * 28; fpy += (rng() - 0.5) * 2.8; ctx.lineTo(fpx, fpy); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // ── Projection helpers ───────────────────────────────────────
    function proj(col: number, row: number) {
      const u = col / (COLS - 1), v = row / (ROWS - 1);
      const tx = TL.x + (TR.x - TL.x) * u, ty = TL.y + (TR.y - TL.y) * u;
      const bx = BL.x + (BR.x - BL.x) * u, by = BL.y + (BR.y - BL.y) * u;
      return { x: tx + (bx - tx) * v, y: ty + (by - ty) * v };
    }
    function getR(row: number) {
      const v = row / (ROWS - 1);
      const lx = TL.x + (BL.x - TL.x) * v, rx = TR.x + (BR.x - TR.x) * v;
      return ((rx - lx) / COLS) * 0.45;
    }

    // ── Draw pins — top → bottom (painter's algorithm) ──────────
    ctx.save();
    corkPath();
    ctx.clip();

    for (let row = 0; row < ROWS; row++) {
      const R = getR(row);

      for (let col = 0; col < COLS; col++) {
        const idx = pixelGrid[row * COLS + col];
        if (idx === -1) continue;
        const { x: px, y: py } = proj(col, row);

        // Concave indentation shadow — ring around pin entry point in cork
        const indent = ctx.createRadialGradient(px, py, R * 0.88, px, py, R * 2.1);
        indent.addColorStop(0,    'rgba(0,0,0,0.55)');
        indent.addColorStop(0.40, 'rgba(0,0,0,0.22)');
        indent.addColorStop(1,    'rgba(0,0,0,0)');
        ctx.fillStyle = indent;
        ctx.beginPath();
        ctx.arc(px, py, R * 2.1, 0, Math.PI * 2);
        ctx.fill();

        // Pin head (flat disc, stem buried in cork)
        drawPin(ctx, px, py, R, palette[idx]);

        // Cork collar — thin ring overlapping pin edge, cork closing around it
        const collar = ctx.createRadialGradient(px, py, R * 0.80, px, py, R * 1.22);
        collar.addColorStop(0,    'rgba(130,72,22,0)');
        collar.addColorStop(0.55, 'rgba(110,58,14,0.60)');
        collar.addColorStop(0.80, 'rgba( 85,40, 8,0.40)');
        collar.addColorStop(1,    'rgba( 60,25, 4,0)');
        ctx.fillStyle = collar;
        ctx.beginPath();
        ctx.arc(px, py, R * 1.22, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // ── Frame front face drawn over edge pins ────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(OTL.x, OTL.y); ctx.lineTo(OTR.x, OTR.y);
    ctx.lineTo(OBR.x, OBR.y); ctx.lineTo(OBL.x, OBL.y);
    ctx.closePath();
    ctx.moveTo(TL.x, TL.y); ctx.lineTo(BL.x, BL.y);
    ctx.lineTo(BR.x, BR.y); ctx.lineTo(TR.x, TR.y);
    ctx.closePath();
    ctx.fillStyle = '#1d1d1f';
    ctx.fill('evenodd');
    // Frame wood / metal grain
    const frng = mulberry32(777);
    for (let i = 0; i < 100; i++) {
      const yg = frng() * OH;
      ctx.globalAlpha = 0.04 + frng() * 0.05;
      ctx.strokeStyle = frng() > 0.5 ? '#2e2e2e' : '#0a0a0a';
      ctx.lineWidth = 0.5 + frng() * 1.5;
      ctx.beginPath();
      ctx.moveTo(0, yg); ctx.lineTo(OW, yg + (frng() - 0.5) * 10);
      ctx.stroke();
    }
    ctx.restore();

    // Frame inner shadow onto cork (top + left edges)
    ctx.save();
    corkPath();
    ctx.clip();
    const tsh = ctx.createLinearGradient(0, TL.y, 0, TL.y + 60);
    tsh.addColorStop(0, 'rgba(0,0,0,0.60)'); tsh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = tsh; ctx.fillRect(0, TL.y - 5, OW, 65);
    const lsh = ctx.createLinearGradient(TL.x, 0, TL.x + 55, 0);
    lsh.addColorStop(0, 'rgba(0,0,0,0.42)'); lsh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lsh; ctx.fillRect(TL.x - 5, 0, 60, OH);
    ctx.restore();

    // Deep black vignette (corners and edges fade to black background)
    const vig = ctx.createRadialGradient(OW * 0.44, OH * 0.38, OW * 0.12, OW * 0.44, OH * 0.38, OW * 0.88);
    vig.addColorStop(0,    'rgba(0,0,0,0)');
    vig.addColorStop(0.62, 'rgba(0,0,0,0)');
    vig.addColorStop(1,    'rgba(0,0,0,0.92)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, OW, OH);

    const link = document.createElement('a');
    link.href = cv.toDataURL('image/png');
    link.download = 'pixel_art_tachuelas.png';
    link.click();
  }

  function downloadCeramicMosaic() {
    const GROUT = 3;
    const TILE  = 29;
    const CELL  = TILE + GROUT;  // 32 px per cell

    const OW = COLS * CELL + GROUT;   // 2051
    const OH = ROWS * CELL + GROUT;   // 3203

    const cv = document.createElement('canvas');
    cv.width = OW; cv.height = OH;
    const ctx = cv.getContext('2d')!;

    const groutHex = groutColor === 'negro' ? '#1c1c1c' : groutColor === 'blanco' ? '#f0ede8' : '#d4cec8';

    // Grout base
    ctx.fillStyle = groutHex;
    ctx.fillRect(0, 0, OW, OH);

    // Subtle grout-line shadow (recessed look)
    ctx.strokeStyle = groutColor === 'negro' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      const lx = c * CELL + Math.floor(GROUT / 2);
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, OH); ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      const ly = r * CELL + Math.floor(GROUT / 2);
      ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(OW, ly); ctx.stroke();
    }

    // Tiles
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = pixelGrid[row * COLS + col];
        if (idx === -1) continue;
        drawCeramicTile(ctx, col * CELL + GROUT, row * CELL + GROUT, TILE, palette[idx]);
      }
    }

    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = 'pixel_art_ceramica.png';
    a.click();
  }

  function downloadLego() {
    const GAP   = 2;
    const BRICK = 30;
    const CELL  = BRICK + GAP;  // 32 px per cell

    const OW = COLS * CELL + GAP;   // 2050
    const OH = ROWS * CELL + GAP;   // 3202

    const cv = document.createElement('canvas');
    cv.width = OW; cv.height = OH;
    const ctx = cv.getContext('2d')!;

    // Dark baseplate gap
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, OW, OH);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = pixelGrid[row * COLS + col];
        if (idx === -1) continue;
        drawLegoBrick(ctx, col * CELL + GAP, row * CELL + GAP, BRICK, palette[idx]);
      }
    }

    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = 'pixel_art_lego.png';
    a.click();
  }

  function downloadTemplate() {
    if (!pixelGrid.length) return;

    const PX_MM = 10;
    const gridW = COLS * PX_MM;
    const gridH = ROWS * PX_MM;
    const MARGIN = 10;
    const CANVAS_W = gridW + MARGIN * 2;
    const CANVAS_H = gridH + MARGIN * 2;

    const rects: string[] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = pixelGrid[row * COLS + col];
        if (idx === -1) continue;
        const x = MARGIN + col * PX_MM;
        const y = MARGIN + row * PX_MM;
        const fill = toHex(palette[idx]);
        const textColor = luminance(palette[idx]) < 128 ? '#fff' : '#000';
        rects.push(
          `<rect x="${x}" y="${y}" width="${PX_MM}" height="${PX_MM}" fill="${fill}" stroke="#555" stroke-width="0.15"/>` +
          `<text x="${(x + PX_MM / 2).toFixed(2)}" y="${(y + PX_MM / 2 + 1).toFixed(2)}" text-anchor="middle" dominant-baseline="middle" font-size="3.5" font-family="Arial,sans-serif" fill="${textColor}" fill-opacity="0.8">${idx + 1}</text>`
        );
      }
    }

    const legendY = MARGIN + gridH + 4;
    const swatchSize = 6;
    const legendItems = palette.map((c, i) => {
      const lx = MARGIN + i * (swatchSize + 12);
      return `<rect x="${lx}" y="${legendY}" width="${swatchSize}" height="${swatchSize}" fill="${toHex(c)}" stroke="#333" stroke-width="0.3"/>` +
             `<text x="${lx + swatchSize + 2}" y="${(legendY + swatchSize / 2 + 1).toFixed(1)}" font-size="4" font-family="Arial,sans-serif" fill="#333">${i + 1}</text>`;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Pixel Art — Plantilla 1:1 (plóter)</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; }
  @page { size: ${CANVAS_W}mm ${CANVAS_H}mm; margin: 0; }
  .no-print { position: fixed; top: 10px; left: 10px; z-index: 999; background: #f97316; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; font-family: sans-serif; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
<button class="no-print" onclick="window.print()">🖨 Imprimir en plóter</button>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${CANVAS_W}mm" height="${CANVAS_H}mm"
     viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="white"/>
  <rect x="${MARGIN}" y="${MARGIN}" width="${gridW}" height="${gridH}" fill="none" stroke="#aaa" stroke-width="0.5" stroke-dasharray="3,3"/>
  ${rects.join('\n  ')}
  ${legendItems}
  <text x="${MARGIN}" y="${(legendY + swatchSize + 5).toFixed(2)}" font-size="3.5" font-family="Arial,sans-serif" fill="#888">Pixel Art — ${COLS}×${ROWS} px · 10 mm/px · ${gridW / 10}cm × ${gridH / 10}cm · escala 1:1</text>
</svg>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pixel_art_plantilla_ploter.html';
    a.click();
  }

  function downloadFoami() {
    const LIGA  = 2;
    const FOAMI = 26;
    const CELL  = FOAMI + LIGA;

    const OW = COLS * CELL + LIGA;
    const OH = ROWS * CELL + LIGA;

    const cv = document.createElement('canvas');
    cv.width = OW; cv.height = OH;
    const ctx = cv.getContext('2d')!;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, OW, OH);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = pixelGrid[row * COLS + col];
        if (idx === -1) continue;
        drawFoamiBrick(ctx, col * CELL + LIGA, row * CELL + LIGA, FOAMI, palette[idx]);
      }
    }

    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = 'pixel_art_foami.png';
    a.click();
  }

  const subjectTotal = counts.reduce((s, c) => s + c, 0);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'sans-serif', color: '#eee' }}>
      <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: '#888', textDecoration: 'none', marginBottom: '1.5rem' }}>
        ← Volver al menú
      </a>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.3rem' }}>🎨 Convertidor Pixel Art</h1>
      <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '2rem' }}>
        Convierte una foto a {COLS}×{ROWS} píxeles con {NUM_COLORS} colores sólidos, sin fondo.
        Cada píxel equivale a 1 cm × 1 cm en la imagen descargada.
      </p>

      {/* Toggle eliminar fondo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
        <div
          onClick={() => setRemoveBg(v => !v)}
          style={{
            width: 44, height: 24, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
            background: removeBg ? '#f97316' : '#333', transition: 'background 0.2s', position: 'relative',
          }}
        >
          <div style={{
            position: 'absolute', top: 3, left: removeBg ? 22 : 3,
            width: 18, height: 18, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s',
          }} />
        </div>
        <span style={{ fontSize: '0.88rem', color: removeBg ? '#eee' : '#666' }}>
          Eliminar fondo automáticamente
        </span>
        {removeBg && <span style={{ fontSize: '0.75rem', color: '#888' }}>(~40 MB primera vez)</span>}
      </div>

      {/* Upload */}
      <div
        onClick={() => phase === 'idle' || phase === 'done' || phase === 'error' ? fileRef.current?.click() : undefined}
        style={{
          border: '2px dashed #333', borderRadius: 12, padding: '2rem',
          textAlign: 'center', cursor: phase === 'idle' || phase === 'done' || phase === 'error' ? 'pointer' : 'default',
          marginBottom: '1.5rem',
          background: phase === 'done' ? 'rgba(249,115,22,0.04)' : 'transparent',
        }}
      >
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.[0]) processImage(e.target.files[0]); }} />
        {phase === 'idle' && <span style={{ color: '#555' }}>Haz clic o arrastra una imagen aquí</span>}
        {(phase === 'removing' || phase === 'processing') && (
          <div>
            <div style={{ color: '#f97316', marginBottom: 8 }}>⏳ {statusMsg}</div>
            <div style={{ background: '#222', borderRadius: 6, height: 6, overflow: 'hidden', maxWidth: 300, margin: '0 auto' }}>
              <div style={{ background: '#f97316', height: '100%', width: phase === 'processing' ? '80%' : '40%', transition: 'width 1s' }} />
            </div>
          </div>
        )}
        {phase === 'done' && <span style={{ color: '#f97316' }}>🖼 {fileName} — haz clic para cambiar</span>}
        {phase === 'error' && <span style={{ color: '#f87171' }}>❌ {statusMsg} — haz clic para intentar con otra imagen</span>}
      </div>

      {phase === 'done' && palette.length > 0 && (
        <>
          {/* Pixel grid */}
          <div style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.5rem' }}>
              Vista previa — {COLS}×{ROWS} · {subjectTotal} píxeles de sujeto
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, ${PX_SCREEN}px)`,
              gridTemplateRows: `repeat(${ROWS}, ${PX_SCREEN}px)`,
              gap: 0,
              border: '1px solid #333',
              width: 'fit-content',
              background: '#111',
            }}>
              {pixelGrid.map((colorIdx, i) => {
                if (colorIdx === -1) return <div key={i} style={{ width: PX_SCREEN, height: PX_SCREEN }} />;
                const [r, g, b] = palette[colorIdx];
                return <div key={i} style={{ width: PX_SCREEN, height: PX_SCREEN, background: `rgb(${r},${g},${b})` }} />;
              })}
            </div>
          </div>

          {/* Palette + counts */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.6rem' }}>Paleta de {NUM_COLORS} colores</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {palette.map((color, i) => {
                const hex = toHex(color);
                const pct = ((counts[i] / subjectTotal) * 100).toFixed(1);
                const textColor = luminance(color) > 128 ? '#000' : '#fff';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 8, flexShrink: 0,
                      background: hex, border: '1px solid #333',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.3rem', fontWeight: 900, color: textColor, fontFamily: 'monospace',
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{hex} — {counts[i]} px</span>
                        <span style={{ fontSize: '0.8rem', color: '#888' }}>{pct}%</span>
                      </div>
                      <div style={{ background: '#222', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                        <div style={{ background: hex, height: '100%', width: `${pct}%`, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Download */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={downloadImage}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 10,
                background: '#f97316', color: '#fff', fontWeight: 700,
                fontSize: '0.95rem', border: 'none', cursor: 'pointer',
              }}
            >
              ⬇ Descargar PNG ({COLS}cm × {ROWS}cm · fondo blanco)
            </button>
            <button
              onClick={downloadGuide}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 10,
                background: 'transparent', color: '#eee', fontWeight: 700,
                fontSize: '0.95rem', border: '1px solid #444', cursor: 'pointer',
              }}
            >
              📄 Descargar guía línea por línea (.html)
            </button>
            <button
              onClick={downloadTemplate}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 10,
                background: 'transparent', color: '#eee', fontWeight: 700,
                fontSize: '0.95rem', border: '1px solid #444', cursor: 'pointer',
              }}
            >
              📐 Descargar plantilla plóter 1:1 (.html)
            </button>
            <button
              onClick={downloadPushPin}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 10,
                background: 'transparent', color: '#eee', fontWeight: 700,
                fontSize: '0.95rem', border: '1px solid #444', cursor: 'pointer',
              }}
            >
              📌 Descargar mosaico de tachuelas (.png)
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
              <span style={{ fontSize: '0.8rem', color: '#888' }}>Lechada:</span>
              {(['negro', 'gris', 'blanco'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setGroutColor(c)}
                  style={{
                    padding: '3px 12px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700,
                    cursor: 'pointer', border: '1px solid',
                    borderColor: groutColor === c ? '#f97316' : '#444',
                    background: groutColor === c ? 'rgba(249,115,22,0.15)' : 'transparent',
                    color: groutColor === c ? '#f97316' : '#888',
                    transition: 'all 0.15s',
                  }}
                >
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={downloadCeramicMosaic}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 10,
                background: 'transparent', color: '#eee', fontWeight: 700,
                fontSize: '0.95rem', border: '1px solid #444', cursor: 'pointer',
              }}
            >
              🔲 Descargar mosaico de azulejos (.png)
            </button>
            <button
              onClick={downloadLego}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 10,
                background: 'transparent', color: '#eee', fontWeight: 700,
                fontSize: '0.95rem', border: '1px solid #444', cursor: 'pointer',
              }}
            >
              🧱 Descargar mosaico Lego (.png)
            </button>
            <button
              onClick={downloadFoami}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 10,
                background: 'transparent', color: '#eee', fontWeight: 700,
                fontSize: '0.95rem', border: '1px solid #444', cursor: 'pointer',
              }}
            >
              🟥 Descargar mosaico de foami (.png)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
