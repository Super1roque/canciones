'use client';
import { useState, useRef } from 'react';
import { Delaunay } from 'd3-delaunay';

const COLS = 64;
const ROWS = 100;
const PX_SCREEN = 10;
const CELL_MM = 10; // physical size of each pixel in the downloaded/plotted output
const CELL_PX = Math.round((96 / 25.4) * CELL_MM); // px at 96 DPI

// 12-level value/temperature palette — like a painter's limited chiaroscuro set:
//  1-3  dark structure (near-black, neutral charcoal, warm umber)
//  4-8  mid shadows, alternating cool/warm to model form (slate blue, sienna, teal, ochre, terracotta)
//  9-12 light planes, warm/cool highlights up to near-white
const FIXED_PALETTE: RGB[] = [
  [0x14, 0x14, 0x1c], // 1  near-black, cool
  [0x2a, 0x2a, 0x2a], // 2  neutral charcoal
  [0x3a, 0x24, 0x18], // 3  dark warm umber
  [0x34, 0x5a, 0x72], // 4  cool mid shadow — slate blue
  [0x9c, 0x4a, 0x2e], // 5  warm mid shadow — burnt sienna
  [0x3f, 0x8a, 0x72], // 6  cool mid — teal green
  [0xc4, 0x89, 0x3a], // 7  warm mid — ochre gold
  [0xc9, 0x8a, 0x72], // 8  neutral-warm transition — dusty terracotta
  [0xee, 0xc9, 0xa0], // 9  warm light — peach cream
  [0xd8, 0xe3, 0xe6], // 10 cool light — pale blue-grey
  [0xf6, 0xe6, 0xcc], // 11 warm highlight
  [0xfd, 0xfa, 0xf4], // 12 near-white highlight
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
function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
// Pulls every #RRGGBB it finds, in order — works on messy pasted text/tables
// (name, description and hex all run together) since only the hex codes matter.
function parsePaletteText(text: string): RGB[] {
  const matches = text.match(/#[0-9A-Fa-f]{6}/g) || [];
  return matches.map(hexToRgb);
}
function luminance(c: RGB) { return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }
// Pushes each channel away from the colour's own luminance — richer hue, same lightness.
// Neutral grays (deviation 0) are left untouched.
function saturate(c: RGB, factor: number): RGB {
  const lum = luminance(c);
  return c.map(v => Math.max(0, Math.min(255, Math.round(lum + (v - lum) * factor)))) as RGB;
}

// Physical size (in cm) that `cells` pixels span at CELL_MM per pixel
function fmtCm(cells: number): string {
  const v = (cells * CELL_MM) / 10;
  return Number.isInteger(v) ? `${v}` : v.toFixed(1);
}

// Opus Incertum ignores the coarse COLS×ROWS grid the square/brick styles use
// entirely — its colours come straight from the original uploaded photo at
// (near) its own native resolution, capped only so the browser stays fast.
const OPUS_MAX_DIM = 700;

// Rasterizes the (already background-processed) image at an arbitrary
// resolution and quantizes it to the NUM_COLORS palette via the same linear
// brightness division, calibrated to that resolution's own subject pixels.
// blurPx softens the source before sampling — at near-native resolution, tiny
// brightness fluctuations (texture, grain, a smooth gradient) constantly cross
// tier boundaries pixel-to-pixel, and since neighbouring tiers in the
// value/temperature palette have quite different hues, that reads as chaotic
// confetti instead of clean bands. Blurring first lets nearby pixels settle
// into the same tier over a meaningfully sized area, without needing to give
// up native-resolution boundary accuracy for genuinely large colour edges.
function rasterizeToGrid(img: HTMLImageElement, bgRemoved: boolean, cols: number, rows: number, blurPx = 0): { grid: Grid; counts: number[]; subjectPixels: RGB[] } {
  const c = document.createElement('canvas');
  c.width = cols; c.height = rows;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, cols, rows);
  if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
  ctx.drawImage(img, 0, 0, cols, rows);
  ctx.filter = 'none';
  const data = ctx.getImageData(0, 0, cols, rows).data;

  const subjectPixels: RGB[] = [];
  const alphaMap: boolean[] = [];
  for (let i = 0; i < cols * rows; i++) {
    const a = data[i * 4 + 3];
    const isSubject = bgRemoved ? a > 128 : true;
    if (isSubject) {
      subjectPixels.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
      alphaMap.push(true);
    } else {
      alphaMap.push(false);
    }
  }

  const counts = Array(NUM_COLORS).fill(0);
  if (subjectPixels.length === 0) {
    return { grid: new Array(cols * rows).fill(-1), counts, subjectPixels };
  }

  // Linear division by brightness, calibrated to THIS raster's own subject
  // pixels: darkest→lightest split into NUM_COLORS equal steps, since the
  // palette is a fixed value/temperature ramp (dark→light), not a hue match.
  // Auto-contrast: stretch between the 2nd/98th percentile, not the literal
  // min/max — a couple of stray outlier pixels (a bright specular highlight,
  // a deep shadow speck) shouldn't get to compress everything else into a
  // narrow middle band of tones. This is what lets a slightly flat/low-contrast
  // photo still use the full 12-tone range without the user having to
  // pre-edit it themselves.
  const subjectLuminances = subjectPixels.map(luminance);
  const sortedLum = [...subjectLuminances].sort((a, b) => a - b);
  const clipFrac = 0.02;
  const loIdx = Math.floor(sortedLum.length * clipFrac);
  const hiIdx = Math.min(sortedLum.length - 1, Math.ceil(sortedLum.length * (1 - clipFrac)));
  const minLum = sortedLum[loIdx];
  const maxLum = sortedLum[hiIdx];
  const lumRange = Math.max(1e-6, maxLum - minLum);

  const grid: Grid = [];
  let subIdx = 0;
  for (let i = 0; i < cols * rows; i++) {
    if (!alphaMap[i]) { grid.push(-1); continue; }
    const t = (subjectLuminances[subIdx] - minLum) / lumRange;
    subIdx++;
    const tier = Math.max(0, Math.min(NUM_COLORS - 1, Math.floor(t * NUM_COLORS)));
    grid.push(tier);
    counts[tier]++;
  }

  return { grid, counts, subjectPixels };
}

// Builds a 12-colour palette from the actual photo's own colours (k-means in
// LAB space, reusing the existing kMeans()) instead of always falling back to
// the generic default swatches — sorted dark→light so it stays compatible
// with the linear brightness tiers used to assign each pixel to a colour.
function derivePaletteFromPixels(pixels: RGB[]): RGB[] {
  if (pixels.length === 0) return FIXED_PALETTE.map(c => [...c] as RGB);
  // K-means is O(runs × iterations × n × k) — cap the sample so it stays fast
  // regardless of how many subject pixels the raster produced.
  const MAX_SAMPLE = 4000;
  let sample = pixels;
  if (pixels.length > MAX_SAMPLE) {
    sample = [];
    const step = pixels.length / MAX_SAMPLE;
    for (let i = 0; i < MAX_SAMPLE; i++) sample.push(pixels[Math.floor(i * step)]);
  }
  const clusters = kMeans(sample, NUM_COLORS);
  return clusters.slice().sort((a, b) => luminance(a) - luminance(b));
}

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
  const [r, g, b] = saturate(color, 1.3);
  const up = (n: number, a: number) => Math.min(255, n + a);
  const dn = (n: number, a: number) => Math.max(0,   n - a);
  const bv = Math.max(2, Math.round(size * 0.10));

  // Base colour
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(x, y, size, size);

  // Top highlight bevel (bright → base) — punchy, like a fresh glaze catching light
  const tg = ctx.createLinearGradient(x, y, x, y + bv);
  tg.addColorStop(0, `rgb(${up(r,75)},${up(g,75)},${up(b,75)})`);
  tg.addColorStop(1, `rgb(${r},${g},${b})`);
  ctx.fillStyle = tg;
  ctx.fillRect(x, y, size, bv);

  // Left highlight bevel
  const lg = ctx.createLinearGradient(x, y, x + bv, y);
  lg.addColorStop(0, `rgb(${up(r,55)},${up(g,55)},${up(b,55)})`);
  lg.addColorStop(1, `rgb(${r},${g},${b})`);
  ctx.fillStyle = lg;
  ctx.fillRect(x, y + bv, bv, size - bv * 2);

  // Bottom shadow bevel (base → dark)
  const btg = ctx.createLinearGradient(x, y + size - bv, x, y + size);
  btg.addColorStop(0, `rgb(${r},${g},${b})`);
  btg.addColorStop(1, `rgb(${dn(r,70)},${dn(g,70)},${dn(b,70)})`);
  ctx.fillStyle = btg;
  ctx.fillRect(x, y + size - bv, size, bv);

  // Right shadow bevel
  const rg = ctx.createLinearGradient(x + size - bv, y, x + size, y);
  rg.addColorStop(0, `rgb(${r},${g},${b})`);
  rg.addColorStop(1, `rgb(${dn(r,60)},${dn(g,60)},${dn(b,60)})`);
  ctx.fillStyle = rg;
  ctx.fillRect(x + size - bv, y + bv, bv, size - bv * 2);

  // Gloss sheen — diagonal linear, stronger for a glazed "brand new" shine
  const gl = ctx.createLinearGradient(x, y, x + size * 0.72, y + size * 0.72);
  gl.addColorStop(0,    'rgba(255,255,255,0.48)');
  gl.addColorStop(0.40, 'rgba(255,255,255,0.14)');
  gl.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(x, y, size, size);
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawStickerBrick(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: RGB) {
  const [r, g, b] = saturate(color, 1.3);
  const up = (n: number, a: number) => Math.min(255, n + a);
  const dn = (n: number, a: number) => Math.max(0,   n - a);
  const bv = Math.max(2, Math.round(size * 0.11));
  const radius = Math.max(2, Math.round(size * 0.16));

  ctx.save();
  roundedRectPath(ctx, x, y, size, size, radius);
  ctx.clip();

  // Base colour
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(x, y, size, size);

  // Top highlight bevel (bright → base)
  const tg = ctx.createLinearGradient(x, y, x, y + bv * 1.6);
  tg.addColorStop(0, `rgb(${up(r,78)},${up(g,78)},${up(b,78)})`);
  tg.addColorStop(1, `rgb(${r},${g},${b})`);
  ctx.fillStyle = tg;
  ctx.fillRect(x, y, size, bv);

  // Left highlight bevel
  const lg = ctx.createLinearGradient(x, y, x + bv, y);
  lg.addColorStop(0, `rgb(${up(r,58)},${up(g,58)},${up(b,58)})`);
  lg.addColorStop(1, `rgb(${r},${g},${b})`);
  ctx.fillStyle = lg;
  ctx.fillRect(x, y + bv, bv, size - bv * 2);

  // Bottom shadow bevel (base → dark)
  const btg = ctx.createLinearGradient(x, y + size - bv, x, y + size);
  btg.addColorStop(0, `rgb(${r},${g},${b})`);
  btg.addColorStop(1, `rgb(${dn(r,72)},${dn(g,72)},${dn(b,72)})`);
  ctx.fillStyle = btg;
  ctx.fillRect(x, y + size - bv, size, bv);

  // Right shadow bevel
  const rg = ctx.createLinearGradient(x + size - bv, y, x + size, y);
  rg.addColorStop(0, `rgb(${r},${g},${b})`);
  rg.addColorStop(1, `rgb(${dn(r,62)},${dn(g,62)},${dn(b,62)})`);
  ctx.fillStyle = rg;
  ctx.fillRect(x + size - bv, y + bv, bv, size - bv * 2);

  // Glossy diagonal sheen — vinyl sticker feel, boosted for a fresh glazed shine
  const gl = ctx.createLinearGradient(x, y, x + size * 0.75, y + size * 0.75);
  gl.addColorStop(0,    'rgba(255,255,255,0.55)');
  gl.addColorStop(0.35, 'rgba(255,255,255,0.16)');
  gl.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(x, y, size, size);

  ctx.restore();

  // Thin sticker-edge outline to define the cut border
  roundedRectPath(ctx, x + 0.5, y + 0.5, size - 1, size - 1, radius);
  ctx.strokeStyle = 'rgba(0,0,0,0.20)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Opus Incertum / trencadís-style "crackle" tessellation: irregular polygons
// covering the ENTIRE canvas edge-to-edge (no grid, no per-cell grout gaps),
// like real broken-tile mosaics or crazed glass. A Voronoi diagram of randomly
// scattered points gives exactly that — cells vary hugely in size (some slivers,
// some big flat patches) and every edge becomes a thin "crack" line, including
// across the background, since the whole canvas is tessellated uniformly.
interface CrackleCell { poly: [number, number][]; colorIdx: number; }

// BFS distance (in grid cells) from every cell to the nearest colour boundary
// (including the subject/background silhouette edge). Used to grow piece size
// in flat interior regions while keeping small, detail-preserving pieces near
// any edge — that's where the image's lights/shadows actually live.
function edgeDistanceMap(grid: Grid, gridCols: number, gridRows: number): number[] {
  const dist = new Array(gridCols * gridRows).fill(Infinity);
  const queue: number[] = [];
  const at = (col: number, row: number) => grid[row * gridCols + col];

  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const here = at(col, row);
      let isEdge = false;
      for (let dr = -1; dr <= 1 && !isEdge; dr++) {
        for (let dc = -1; dc <= 1 && !isEdge; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nc = col + dc, nr = row + dr;
          const neighbor = (nc >= 0 && nc < gridCols && nr >= 0 && nr < gridRows) ? at(nc, nr) : -1;
          if (neighbor !== here) isEdge = true;
        }
      }
      if (isEdge) { dist[row * gridCols + col] = 0; queue.push(row * gridCols + col); }
    }
  }

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const row = Math.floor(idx / gridCols), col = idx % gridCols, d = dist[idx];
    const neighbors: [number, number][] = [[col - 1, row], [col + 1, row], [col, row - 1], [col, row + 1]];
    for (const [nc, nr] of neighbors) {
      if (nc < 0 || nc >= gridCols || nr < 0 || nr >= gridRows) continue;
      const ni = nr * gridCols + nc;
      if (dist[ni] > d + 1) { dist[ni] = d + 1; queue.push(ni); }
    }
  }
  return dist;
}

// baseSpacing/maxSpacing are in canvas units (≈ side length of an equivalent
// square piece). Pieces grow from baseSpacing up to maxSpacing the further they
// are from a colour edge, via rejection-thinning a dense candidate scatter down
// to the locally appropriate density — so detail near edges stays sharp while
// flat regions get noticeably bigger pieces. Pure random (not jittered-grid)
// scatter is what gives the organic size variance of real broken tile.
// `grid` should be a fine-resolution (gridCols×gridRows) colour raster of the
// actual photo's silhouette — NOT the coarse COLS×ROWS grid the square/brick
// styles use — so boundary seeding below traces the real contours, not blocky
// grid-cell steps.
function buildCrackleCells(
  canvasW: number, canvasH: number, grid: Grid, gridCols: number, gridRows: number,
  baseSpacing: number, maxSpacing: number, seed: number
): CrackleCell[] {
  const rng = mulberry32(seed);
  const edgeDist = edgeDistanceMap(grid, gridCols, gridRows);
  // Reach maxSpacing after ~2.5 baseSpacing units of real distance from any
  // colour edge — expressed per grid-cell (edgeDist's unit) so the transition
  // stays the same physical distance regardless of how fine `grid` is. Using a
  // flat "2.5 grid-cells" here would make flat regions grow 3x slower once fed
  // Opus Incertum's fine grid (3x finer than the coarse azulejo one) instead of
  // the coarse grid, since each fine cell covers a third of the real distance.
  const fineCellSize = Math.min(canvasW / gridCols, canvasH / gridRows);
  const growth = (maxSpacing - baseSpacing) / ((baseSpacing * 2.5) / fineCellSize);

  function localSpacingAt(x: number, y: number): number {
    const col = Math.min(gridCols - 1, Math.max(0, Math.floor((x / canvasW) * gridCols)));
    const row = Math.min(gridRows - 1, Math.max(0, Math.floor((y / canvasH) * gridRows)));
    return Math.min(maxSpacing, baseSpacing + edgeDist[row * gridCols + col] * growth);
  }

  const flatPoints: number[] = [];
  const points: [number, number][] = [];

  // Boundary seeds: for every micro-edge between two differently-coloured fine
  // cells, push a point inward from each side by roughly baseSpacing/2 — deep
  // enough to blend smoothly with the interior scatter's own scale, instead of
  // sitting shallow at the fine cell's own centre (only ~half a FINE cell in,
  // which is much shallower than baseSpacing — a whole band of nearly-as-shallow
  // points along any straight run of boundary collapses into a strip of thin
  // slivers between the boundary and the first ring of interior points). Each
  // push is verified against the fine grid and falls back to a shallower depth
  // if it would overshoot past a thin feature (a small eye, a narrow highlight)
  // into the wrong colour. Deduped per (baseSpacing bucket, colour).
  const cellW = canvasW / gridCols, cellH = canvasH / gridRows;
  const seenBoundary = new Set<string>();
  const candidateDepths = [baseSpacing / 2, baseSpacing / 3, baseSpacing / 5, Math.min(cellW, cellH) * 0.5];

  function placeBoundarySeed(px0: number, py0: number, axis: 'x' | 'y', dir: number, wantColor: number) {
    for (const depth of candidateDepths) {
      const px = axis === 'x' ? px0 + dir * depth : px0;
      const py = axis === 'y' ? py0 + dir * depth : py0;
      const testCol = Math.min(gridCols - 1, Math.max(0, Math.floor((px / canvasW) * gridCols)));
      const testRow = Math.min(gridRows - 1, Math.max(0, Math.floor((py / canvasH) * gridRows)));
      if (grid[testRow * gridCols + testCol] !== wantColor) continue;
      const key = `${Math.floor(px / baseSpacing)},${Math.floor(py / baseSpacing)},${wantColor}`;
      if (seenBoundary.has(key)) return;
      seenBoundary.add(key);
      points.push([px, py]);
      flatPoints.push(px, py);
      return;
    }
  }

  const at = (col: number, row: number) => grid[row * gridCols + col];
  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const here = at(col, row);
      if (col + 1 < gridCols && at(col + 1, row) !== here) {
        const bx = (col + 1) * cellW, by = (row + 0.5) * cellH + (rng() - 0.5) * cellH * 0.3;
        placeBoundarySeed(bx, by, 'x', -1, here);
        placeBoundarySeed(bx, by, 'x', 1, at(col + 1, row));
      }
      if (row + 1 < gridRows && at(col, row + 1) !== here) {
        const bx = (col + 0.5) * cellW + (rng() - 0.5) * cellW * 0.3, by = (row + 1) * cellH;
        placeBoundarySeed(bx, by, 'y', -1, here);
        placeBoundarySeed(bx, by, 'y', 1, at(col, row + 1));
      }
    }
  }

  // Interior scatter: dense random candidates, thinned to the locally
  // appropriate density AND checked against a minimum distance to already-
  // accepted interior points (a lightweight Poisson-disc pass). Density
  // thinning alone is a pure Poisson process: even at low odds, two
  // candidates can survive right next to each other purely by chance,
  // stranding a small piece in an otherwise flat, edge-free area for no
  // reason tied to the image. Enforcing a minimum gap removes that
  // pure-chance clumping so flat regions merge into consistently large
  // pieces instead of occasionally fragmenting at random.
  const bucketSize = baseSpacing;
  const spatialHash = new Map<string, [number, number][]>();
  function tooClose(x: number, y: number, minDist: number): boolean {
    const bx = Math.floor(x / bucketSize), by = Math.floor(y / bucketSize);
    const reach = Math.ceil(minDist / bucketSize);
    for (let dby = -reach; dby <= reach; dby++) {
      for (let dbx = -reach; dbx <= reach; dbx++) {
        const bucket = spatialHash.get(`${bx + dbx},${by + dby}`);
        if (!bucket) continue;
        for (const [px, py] of bucket) {
          const dx = px - x, dy = py - y;
          if (dx * dx + dy * dy < minDist * minDist) return true;
        }
      }
    }
    return false;
  }

  const nCandidates = Math.max(4, Math.round((canvasW * canvasH) / (baseSpacing * baseSpacing)));
  for (let i = 0; i < nCandidates; i++) {
    const x = rng() * canvasW, y = rng() * canvasH;
    const s = localSpacingAt(x, y);
    const keepProb = (baseSpacing * baseSpacing) / (s * s);
    if (rng() > keepProb) continue;
    if (tooClose(x, y, s * 0.75)) continue;
    points.push([x, y]);
    flatPoints.push(x, y);
    const bx = Math.floor(x / bucketSize), by = Math.floor(y / bucketSize);
    const key = `${bx},${by}`;
    const bucket = spatialHash.get(key);
    if (bucket) bucket.push([x, y]); else spatialHash.set(key, [[x, y]]);
  }

  const delaunay = new Delaunay(flatPoints);
  const voronoi = delaunay.voronoi([0, 0, canvasW, canvasH]);

  const cells: CrackleCell[] = [];
  for (let i = 0; i < points.length; i++) {
    const poly = voronoi.cellPolygon(i);
    if (!poly) continue;
    const [px, py] = points[i];
    const col = Math.floor((px / canvasW) * gridCols);
    const row = Math.floor((py / canvasH) * gridRows);
    const colorIdx = (col >= 0 && col < gridCols && row >= 0 && row < gridRows) ? grid[row * gridCols + col] : -1;
    cells.push({ poly, colorIdx });
  }
  return cells;
}

// Shrinks a polygon toward its own centroid by a fixed distance (not a
// percentage) — this is what turns an edge-to-edge Voronoi tessellation into
// separate pieces with a real physical gap ("liga"/grout) between them, the
// same way the azulejo template sizes each square tile smaller than its cell.
function insetPolygon(poly: [number, number][], dist: number): [number, number][] {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return poly.map(([x, y]) => {
    const dx = x - cx, dy = y - cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const shrink = Math.min(dist, len * 0.4); // cap so tiny pieces don't invert
    return [x - (dx / len) * shrink, y - (dy / len) * shrink] as [number, number];
  });
}

function drawCrackleCell(ctx: CanvasRenderingContext2D, poly: [number, number][], color: RGB, carveBlur: number, rng: () => number) {
  // Kiln variation: real glazed tiles from the same "colour" batch are never
  // perfectly uniform — a touch of per-piece jitter is what reads as authentic
  // handmade ceramic instead of a flat digital fill, regardless of whether the
  // subject is a face, a landscape, a flower or fruit.
  const jitter = (rng() - 0.5) * 14;
  const sat = saturate(color, 1.2);
  const r = Math.max(0, Math.min(255, sat[0] + jitter));
  const g = Math.max(0, Math.min(255, sat[1] + jitter));
  const b = Math.max(0, Math.min(255, sat[2] + jitter));
  const up = (n: number, a: number) => Math.min(255, n + a);
  const dn = (n: number, a: number) => Math.max(0,   n - a);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of poly) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }

  const path = () => {
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
  };

  // Carved-groove shadow: a soft dark halo that bleeds outward from the piece's
  // own silhouette into the grout gap, reading as a recessed channel around a
  // raised tile — same trick as the azulejo adhesive template's carveBlur filter,
  // done here with the canvas's native shadow instead of a duplicated shape.
  // The shadow only shows where it extends past the (opaque) fill itself, so a
  // single shadowed fill is enough — no need to redraw it afterward.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = carveBlur;
  path();
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fill();
  ctx.restore();

  // Directional glaze bevel across the piece's own bounding box — light top-left, dark bottom-right
  ctx.save();
  path();
  ctx.clip();
  const gl = ctx.createLinearGradient(minX, minY, maxX, maxY);
  gl.addColorStop(0,   `rgba(${up(r,55)},${up(g,55)},${up(b,55)},0.40)`);
  gl.addColorStop(0.5, 'rgba(255,255,255,0)');
  gl.addColorStop(1,   `rgba(${dn(r,45)},${dn(g,45)},${dn(b,45)},0.35)`);
  ctx.fillStyle = gl;
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

  // Glazed gloss sheen — a soft specular highlight like real ceramic catching
  // sunlight, positioned toward the same light-source corner as the bevel.
  const glossCx = minX + (maxX - minX) * 0.32;
  const glossCy = minY + (maxY - minY) * 0.26;
  const glossR = Math.max(maxX - minX, maxY - minY) * 0.6;
  const gloss = ctx.createRadialGradient(glossCx, glossCy, 0, glossCx, glossCy, glossR);
  gloss.addColorStop(0,   'rgba(255,255,255,0.42)');
  gloss.addColorStop(0.5, 'rgba(255,255,255,0.10)');
  gloss.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
  ctx.restore();

  // Thin edge outline defining the piece against the grout
  path();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Flat "geometric pop art" rendering: same tessellation as the ceramic Opus
// Incertum (angular pieces tracing the photo's real silhouette), but no
// bevel, gloss or kiln jitter — a bold, punchy solid colour per piece and a
// thick dark outline instead, closer to vector illustration / mural art than
// physical ceramic. Pieces are drawn edge-to-edge (no grout inset): the thick
// stroke on each side of a shared boundary is what reads as the separator.
function drawFlatCell(ctx: CanvasRenderingContext2D, poly: [number, number][], color: RGB) {
  const [r, g, b] = saturate(color, 1.9);

  const path = () => {
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
  };

  path();
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fill();

  path();
  ctx.strokeStyle = '#0a0a0a';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();
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

function drawGarbanzo(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, color: RGB, rot: number) {
  const [r, g, b] = color;
  const up = (n: number, a: number) => Math.min(255, n + a);
  const dn = (n: number, a: number) => Math.max(0,   n - a);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);

  // Lumpy rounded body with a small "beak" — the characteristic chickpea point
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-0.05 * R, -1.05 * R);
    ctx.bezierCurveTo(0.55 * R, -0.95 * R, 0.98 * R, -0.35 * R, 0.90 * R,  0.20 * R);
    ctx.bezierCurveTo(0.85 * R,  0.75 * R, 0.35 * R,  1.02 * R, -0.15 * R, 0.95 * R);
    ctx.bezierCurveTo(-0.70 * R, 0.88 * R, -1.00 * R, 0.30 * R, -0.92 * R, -0.30 * R);
    ctx.bezierCurveTo(-0.85 * R, -0.80 * R, -0.45 * R, -1.02 * R, -0.05 * R, -1.05 * R);
    ctx.closePath();
  };

  // Drop shadow
  ctx.save();
  ctx.translate(R * 0.12, R * 0.16);
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = '#000';
  path();
  ctx.fill();
  ctx.restore();

  // Base matte colour
  path();
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fill();

  // Soft directional highlight + opposite shadow — matte surface, no gloss
  ctx.save();
  path();
  ctx.clip();
  const hl = ctx.createRadialGradient(-R * 0.35, -R * 0.5, R * 0.05, -R * 0.1, -R * 0.1, R * 1.4);
  hl.addColorStop(0,   `rgba(${up(r,60)},${up(g,60)},${up(b,60)},0.55)`);
  hl.addColorStop(0.5, `rgba(${up(r,20)},${up(g,20)},${up(b,20)},0.12)`);
  hl.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(-1.2 * R, -1.2 * R, 2.4 * R, 2.4 * R);

  const sd = ctx.createRadialGradient(R * 0.35, R * 0.5, R * 0.1, R * 0.2, R * 0.3, R * 1.3);
  sd.addColorStop(0, `rgba(${dn(r,40)},${dn(g,40)},${dn(b,40)},0.30)`);
  sd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sd;
  ctx.fillRect(-1.2 * R, -1.2 * R, 2.4 * R, 2.4 * R);

  // Rim shading — subtle dark boundary
  const edge = ctx.createRadialGradient(0, 0, R * 0.82, 0, 0, R * 1.05);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, `rgba(${dn(r,70)},${dn(g,70)},${dn(b,70)},0.55)`);
  ctx.fillStyle = edge;
  ctx.fillRect(-1.2 * R, -1.2 * R, 2.4 * R, 2.4 * R);
  ctx.restore();

  // Hilum crease — small groove near the beak
  ctx.beginPath();
  ctx.moveTo(-0.10 * R, -0.95 * R);
  ctx.quadraticCurveTo(0.10 * R, -0.62 * R, -0.02 * R, -0.30 * R);
  ctx.strokeStyle = `rgba(${dn(r,60)},${dn(g,60)},${dn(b,60)},0.45)`;
  ctx.lineWidth = Math.max(1, R * 0.07);
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.restore();
}

function drawPebbleStone(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, color: RGB, rng: () => number) {
  const [r, g, b] = color;
  const up = (n: number, a: number) => Math.min(255, n + a);
  const dn = (n: number, a: number) => Math.max(0,   n - a);

  // Slight per-stone colour jitter — natural stone is never perfectly uniform
  const j = (rng() - 0.5) * 22;
  const jr = Math.max(0, Math.min(255, r + j));
  const jg = Math.max(0, Math.min(255, g + j));
  const jb = Math.max(0, Math.min(255, b + j));

  // Irregular rounded polygon — random vertices smoothed with quadratic curves
  const N = 9 + Math.floor(rng() * 5);
  const angleOffset = rng() * Math.PI * 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = angleOffset + (i / N) * Math.PI * 2;
    const rad = R * (0.62 + rng() * 0.40);
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  const path = () => {
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % N];
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      if (i === 0) {
        const [px, py] = pts[N - 1];
        ctx.moveTo((px + x0) / 2, (py + y0) / 2);
      }
      ctx.quadraticCurveTo(x0, y0, mx, my);
    }
    ctx.closePath();
  };

  // Drop shadow
  ctx.save();
  ctx.translate(R * 0.10, R * 0.14);
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#000';
  path();
  ctx.fill();
  ctx.restore();

  // Base matte colour
  path();
  ctx.fillStyle = `rgb(${jr},${jg},${jb})`;
  ctx.fill();

  ctx.save();
  path();
  ctx.clip();

  // Directional matte highlight (light catching the top-left face)
  const hl = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx - R * 0.1, cy - R * 0.1, R * 1.3);
  hl.addColorStop(0,    `rgba(${up(jr,55)},${up(jg,55)},${up(jb,55)},0.50)`);
  hl.addColorStop(0.55, `rgba(${up(jr,15)},${up(jg,15)},${up(jb,15)},0.10)`);
  hl.addColorStop(1,    'rgba(0,0,0,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(cx - 1.3 * R, cy - 1.3 * R, 2.6 * R, 2.6 * R);

  // Opposite soft shadow
  const sd = ctx.createRadialGradient(cx + R * 0.35, cy + R * 0.4, R * 0.05, cx + R * 0.2, cy + R * 0.3, R * 1.2);
  sd.addColorStop(0, `rgba(${dn(jr,45)},${dn(jg,45)},${dn(jb,45)},0.32)`);
  sd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sd;
  ctx.fillRect(cx - 1.3 * R, cy - 1.3 * R, 2.6 * R, 2.6 * R);

  // Fine mineral speckle grain
  const speckles = 12 + Math.floor(rng() * 10);
  for (let i = 0; i < speckles; i++) {
    const sx = cx + (rng() - 0.5) * R * 1.7;
    const sy = cy + (rng() - 0.5) * R * 1.7;
    const sr = 0.35 + rng() * 0.85;
    const dark = rng() > 0.5;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fillStyle = dark
      ? `rgba(${dn(jr,50)},${dn(jg,50)},${dn(jb,50)},0.35)`
      : `rgba(${up(jr,50)},${up(jg,50)},${up(jb,50)},0.30)`;
    ctx.fill();
  }

  // Rim shading — subtle dark boundary defining the stone edge
  const edge = ctx.createRadialGradient(cx, cy, R * 0.75, cx, cy, R * 1.05);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, `rgba(${dn(jr,60)},${dn(jg,60)},${dn(jb,60)},0.50)`);
  ctx.fillStyle = edge;
  ctx.fillRect(cx - 1.3 * R, cy - 1.3 * R, 2.6 * R, 2.6 * R);

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
  const [fineGrid, setFineGrid] = useState<Grid>([]);
  const [fineGridCols, setFineGridCols] = useState(0);
  const [fineGridRows, setFineGridRows] = useState(0);
  const [palette, setPalette] = useState<RGB[]>([]);
  const [counts, setCounts] = useState<number[]>([]);
  const [fileName, setFileName] = useState('');
  const [removeBg, setRemoveBg] = useState(false);
  const [groutColor, setGroutColor] = useState<'negro' | 'gris' | 'blanco'>('gris');
  const [customPalette, setCustomPalette] = useState<RGB[]>(() => FIXED_PALETTE.map(c => [...c] as RGB));
  const [showPaletteEditor, setShowPaletteEditor] = useState(false);
  const [paletteImportText, setPaletteImportText] = useState('');
  const [paletteImportStatus, setPaletteImportStatus] = useState('');

  function applyPaletteFromText() {
    const found = parsePaletteText(paletteImportText);
    if (found.length === 0) {
      setPaletteImportStatus('No se encontraron códigos de color (#RRGGBB) en el texto.');
      return;
    }
    const n = Math.min(found.length, NUM_COLORS);
    setCustomPalette(prev => prev.map((c, i) => i < n ? found[i] : c));
    if (found.length === NUM_COLORS) {
      setPaletteImportStatus(`✓ Paleta actualizada con los ${NUM_COLORS} colores encontrados.`);
    } else if (found.length < NUM_COLORS) {
      setPaletteImportStatus(`⚠ Se encontraron ${found.length} de ${NUM_COLORS} colores esperados. Se actualizaron los primeros ${found.length}; el resto quedó igual.`);
    } else {
      setPaletteImportStatus(`⚠ Se encontraron ${found.length} colores; se usaron solo los primeros ${NUM_COLORS}.`);
    }
  }

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
      URL.revokeObjectURL(url);

      // Coarse grid: same COLS×ROWS resolution used by every square/brick style
      const { grid, counts: cnt, subjectPixels } = rasterizeToGrid(img, bgRemoved, COLS, ROWS);
      if (cnt.reduce((s, n) => s + n, 0) === 0) {
        setPhase('error');
        setStatusMsg('No se encontró sujeto en la imagen.');
        return;
      }

      // Derive this photo's own 12-colour palette (k-means on its actual
      // subject pixels) instead of always falling back to the generic default
      // swatches — replaces whatever palette was showing before, manually
      // edited or not, same as picking a fresh photo starts fresh.
      const photoPalette = derivePaletteFromPixels(subjectPixels);
      setCustomPalette(photoPalette);

      // Fine grid for Opus Incertum: ignores the coarse COLS×ROWS grid entirely
      // and takes colours straight from the original photo at (near) its own
      // native resolution — capped only so the browser stays responsive — so
      // its colour boundaries trace the real silhouette, not a blocky grid.
      const opusScale = Math.min(1, OPUS_MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
      const opusCols = Math.max(1, Math.round(img.naturalWidth * opusScale));
      const opusRows = Math.max(1, Math.round(img.naturalHeight * opusScale));
      const opusBlurPx = Math.max(1, opusCols / 150); // scales with resolution, not a fixed pixel count
      const { grid: fine } = rasterizeToGrid(img, bgRemoved, opusCols, opusRows, opusBlurPx);

      // Palette is already ordered dark→light, no re-sort needed
      setPalette(photoPalette);
      setPixelGrid(grid);
      setFineGrid(fine);
      setFineGridCols(opusCols);
      setFineGridRows(opusRows);
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
    c.width = COLS * CELL_PX;
    c.height = ROWS * CELL_PX;
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
        ctx.fillRect(col * CELL_PX, row * CELL_PX, CELL_PX, CELL_PX);
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

  function downloadOpusIncertumMosaic() {
    if (!fineGrid.length) return;
    const CELL = 32; // same physical scale as the ceramic/azulejo mosaic: 1 grid px = 1cm² = 32 canvas-px
    const OW = COLS * CELL;
    const OH = ROWS * CELL;
    const PX_PER_MM = CELL / CELL_MM;       // 3.2 canvas-px per mm at this scale
    const GROUT_MM = 1.5;
    const INSET = (GROUT_MM * PX_PER_MM) / 2; // each neighbouring piece gives up half the grout joint

    const cv = document.createElement('canvas');
    cv.width = OW; cv.height = OH;
    const ctx = cv.getContext('2d')!;

    // Flat grout background first (like the azulejo mosaic) — only subject
    // pieces get drawn on top, each shrunk by INSET so the grout shows through
    // a real gap between them, not just a stroke line.
    const bgHex = groutColor === 'negro' ? '#1c1c1c' : groutColor === 'blanco' ? '#f0ede8' : '#d4cec8';
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, OW, OH);

    // Piece area starts at CELL² = 1cm² near any colour edge (same granularity
    // as the azulejo grid) and grows up to ~225cm² in flat same-colour interior
    // regions, so uniform areas aren't over-fragmented. Uses the fine colour
    // raster (not pixelGrid) so boundaries trace the real photo.
    const cells = buildCrackleCells(OW, OH, fineGrid, fineGridCols, fineGridRows, CELL, CELL * 15, 90210);
    const kilnRng = mulberry32(13);
    for (const cell of cells) {
      if (cell.colorIdx === -1) continue;
      drawCrackleCell(ctx, insetPolygon(cell.poly, INSET), palette[cell.colorIdx], INSET * 3.2, kilnRng);
    }

    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = 'pixel_art_opus_incertum.png';
    a.click();
  }

  function downloadPopArtMosaic() {
    if (!fineGrid.length) return;
    const CELL = 32; // same physical scale as the ceramic/azulejo mosaic
    const OW = COLS * CELL;
    const OH = ROWS * CELL;

    const cv = document.createElement('canvas');
    cv.width = OW; cv.height = OH;
    const ctx = cv.getContext('2d')!;

    // Dark background — pieces sit edge-to-edge with no grout gap, the thick
    // outline on each piece is what separates them (vector-illustration look).
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, OW, OH);

    const cells = buildCrackleCells(OW, OH, fineGrid, fineGridCols, fineGridRows, CELL, CELL * 15, 90210);
    for (const cell of cells) {
      if (cell.colorIdx === -1) continue;
      drawFlatCell(ctx, cell.poly, palette[cell.colorIdx]);
    }

    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = 'pixel_art_pop_art.png';
    a.click();
  }

  function downloadStickerMosaic() {
    const GROUT = 1.5; // ~0.5mm separation between tiles, same scale as the other mosaics
    const TILE  = 29;
    const CELL  = TILE + GROUT;

    const OW = COLS * CELL + GROUT;
    const OH = ROWS * CELL + GROUT;

    const cv = document.createElement('canvas');
    cv.width = OW; cv.height = OH;
    const ctx = cv.getContext('2d')!;

    // Backing sheet colour showing through the 1mm gaps
    ctx.fillStyle = '#e7e5e1';
    ctx.fillRect(0, 0, OW, OH);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = pixelGrid[row * COLS + col];
        if (idx === -1) continue;
        drawStickerBrick(ctx, col * CELL + GROUT, row * CELL + GROUT, TILE, palette[idx]);
      }
    }

    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = 'pixel_art_ladrillos_adhesivo.png';
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

  function downloadPaletteSheet() {
    const PAGE_W = 210; // A4 mm
    const PAGE_H = 297;
    const MARGIN = 15;
    const TITLE_H = 18;
    const cols = 3;
    const rows = Math.ceil(NUM_COLORS / cols);
    const gap = 8;
    const usableW = PAGE_W - MARGIN * 2;
    const usableH = PAGE_H - MARGIN * 2 - TITLE_H;
    const swatchSize = Math.min(
      (usableW - gap * (cols - 1)) / cols,
      (usableH - gap * (rows - 1)) / rows
    );

    const items = customPalette.map((c, i) => {
      const hex = toHex(c);
      const textColor = luminance(c) > 128 ? '#000' : '#fff';
      return `<div class="swatch" style="background:${hex};color:${textColor}">
        <span class="num">${i + 1}</span>
        <span class="code">${hex}</span>
      </div>`;
    }).join('\n      ');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Paleta de colores — hoja de referencia</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; font-family: Arial, sans-serif; }
  @page { size: ${PAGE_W}mm ${PAGE_H}mm; margin: 0; }
  .page { width: ${PAGE_W}mm; height: ${PAGE_H}mm; padding: ${MARGIN}mm; }
  h1 { font-size: 5mm; color: #333; margin-bottom: ${TITLE_H - 5}mm; }
  .grid {
    display: grid;
    grid-template-columns: repeat(${cols}, ${swatchSize}mm);
    grid-auto-rows: ${swatchSize}mm;
    gap: ${gap}mm;
  }
  .swatch {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    border: 0.3mm solid rgba(0,0,0,0.25); border-radius: 2mm;
  }
  .num { font-size: 9mm; font-weight: 900; line-height: 1.2; }
  .code { font-family: monospace; font-size: 4mm; font-weight: 700; opacity: 0.85; }
  .no-print { position: fixed; top: 10px; left: 10px; z-index: 999; background: #f97316; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; font-family: sans-serif; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
<button class="no-print" onclick="window.print()">🖨 Imprimir / Guardar como PDF</button>
<div class="page">
  <h1>Paleta de colores — ${NUM_COLORS} tonos</h1>
  <div class="grid">
      ${items}
  </div>
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'paleta_colores.html';
    a.click();
  }

  function downloadTemplate() {
    if (!pixelGrid.length) return;

    const PX_MM = CELL_MM;
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
  <text x="${MARGIN}" y="${(legendY + swatchSize + 5).toFixed(2)}" font-size="3.5" font-family="Arial,sans-serif" fill="#888">Pixel Art — ${COLS}×${ROWS} px · ${PX_MM} mm/px · ${gridW / 10}cm × ${gridH / 10}cm · escala 1:1</text>
</svg>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pixel_art_plantilla_ploter.html';
    a.click();
  }

  function downloadStickerTemplate() {
    if (!pixelGrid.length) return;

    // Same proportions as the adhesive-sticker mosaic: 1.5mm gap, square corners — same as the ceramic-azulejo mosaic
    const PX_MM = CELL_MM;
    const GAP_MM = 1.5;
    const SIZE_MM = PX_MM - GAP_MM;
    const gridW = COLS * PX_MM;
    const gridH = ROWS * PX_MM;
    const MARGIN = 10;
    const CANVAS_W = gridW + MARGIN * 2;
    const CANVAS_H = gridH + MARGIN * 2;

    // Same bevel model as the ceramic-azulejo mosaic (drawCeramicTile): four directional
    // strips — bright top/left, dark bottom/right — plus a diagonal gloss sheen. Each
    // strip's gradient is defined relative to its own bounding box, so one definition
    // per palette colour is reused at every position regardless of size.
    const up = (n: number, a: number) => Math.min(255, n + a);
    const dn = (n: number, a: number) => Math.max(0,   n - a);
    const bv = SIZE_MM * 0.10;
    // Richer, more saturated hue (same lightness) for a glossier, "fresh glaze" ceramic look
    const satPalette = palette.map(c => saturate(c, 1.3));
    const bevelGradDefs = satPalette.map((c, i) => {
      const [r, g, b] = c;
      const base = toHex(c);
      return `<linearGradient id="topGrad${i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgb(${up(r,75)},${up(g,75)},${up(b,75)})"/>
      <stop offset="100%" stop-color="${base}"/>
    </linearGradient>
    <linearGradient id="leftGrad${i}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="rgb(${up(r,55)},${up(g,55)},${up(b,55)})"/>
      <stop offset="100%" stop-color="${base}"/>
    </linearGradient>
    <linearGradient id="bottomGrad${i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${base}"/>
      <stop offset="100%" stop-color="rgb(${dn(r,70)},${dn(g,70)},${dn(b,70)})"/>
    </linearGradient>
    <linearGradient id="rightGrad${i}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${base}"/>
      <stop offset="100%" stop-color="rgb(${dn(r,60)},${dn(g,60)},${dn(b,60)})"/>
    </linearGradient>`;
    }).join('\n    ');
    const glossGradDef = `<linearGradient id="glossGrad" x1="0" y1="0" x2="0.72" y2="0.72">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.48"/>
      <stop offset="40%" stop-color="#fff" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>`;
    // Carved-groove shadow around each tile — a blurred duplicate of the tile's own
    // square silhouette, so the halo hugs the actual shape. Half the blur hides under
    // the tile, half bleeds into the gap, reading as a recessed channel around a raised body.
    const carveBlurDef = `<filter id="carveBlur" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="0.45"/>
    </filter>`;
    const defs = `<defs>\n    ${bevelGradDefs}\n    ${glossGradDef}\n    ${carveBlurDef}\n  </defs>`;

    const rects: string[] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = pixelGrid[row * COLS + col];
        if (idx === -1) continue;
        const x = MARGIN + col * PX_MM + GAP_MM / 2;
        const y = MARGIN + row * PX_MM + GAP_MM / 2;
        const xf = x.toFixed(2), yf = y.toFixed(2);
        rects.push(
          `<rect x="${xf}" y="${yf}" width="${SIZE_MM}" height="${SIZE_MM}" fill="rgba(0,0,0,0.65)" filter="url(#carveBlur)"/>` +
          `<rect x="${xf}" y="${yf}" width="${SIZE_MM}" height="${SIZE_MM}" fill="${toHex(satPalette[idx])}"/>` +
          `<rect x="${xf}" y="${yf}" width="${SIZE_MM}" height="${bv.toFixed(2)}" fill="url(#topGrad${idx})"/>` +
          `<rect x="${xf}" y="${(y + bv).toFixed(2)}" width="${bv.toFixed(2)}" height="${(SIZE_MM - bv * 2).toFixed(2)}" fill="url(#leftGrad${idx})"/>` +
          `<rect x="${xf}" y="${(y + SIZE_MM - bv).toFixed(2)}" width="${SIZE_MM}" height="${bv.toFixed(2)}" fill="url(#bottomGrad${idx})"/>` +
          `<rect x="${(x + SIZE_MM - bv).toFixed(2)}" y="${(y + bv).toFixed(2)}" width="${bv.toFixed(2)}" height="${(SIZE_MM - bv * 2).toFixed(2)}" fill="url(#rightGrad${idx})"/>` +
          `<rect x="${xf}" y="${yf}" width="${SIZE_MM}" height="${SIZE_MM}" fill="url(#glossGrad)"/>` +
          `<rect x="${xf}" y="${yf}" width="${SIZE_MM}" height="${SIZE_MM}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="0.15"/>`
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
<title>Pixel Art — Plantilla adhesiva 1:1 (plóter)</title>
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
  ${defs}
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="white"/>
  <rect x="${MARGIN}" y="${MARGIN}" width="${gridW}" height="${gridH}" fill="none" stroke="#aaa" stroke-width="0.5" stroke-dasharray="3,3"/>
  ${rects.join('\n  ')}
  ${legendItems}
  <text x="${MARGIN}" y="${(legendY + swatchSize + 5).toFixed(2)}" font-size="3.5" font-family="Arial,sans-serif" fill="#888">Pixel Art adhesivo — ${COLS}×${ROWS} px · ${PX_MM} mm/px · separación ${GAP_MM}mm · ${gridW / 10}cm × ${gridH / 10}cm · escala 1:1</text>
</svg>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pixel_art_plantilla_ploter_adhesivo.html';
    a.click();
  }

  function downloadOpusIncertumTemplate() {
    if (!fineGrid.length) return;

    const PX_MM = CELL_MM;
    const gridW = COLS * PX_MM;
    const gridH = ROWS * PX_MM;
    const MARGIN = 10;
    const CANVAS_W = gridW + MARGIN * 2;
    const CANVAS_H = gridH + MARGIN * 2;

    // One glaze-bevel gradient per palette colour (objectBoundingBox-relative,
    // so the same def is reused by every piece of that colour regardless of
    // its position/size — same trick as the azulejo adhesive template).
    const up = (n: number, a: number) => Math.min(255, n + a);
    const dn = (n: number, a: number) => Math.max(0,   n - a);
    const satPalette = palette.map(c => saturate(c, 1.2));
    const glazeGradDefs = satPalette.map((c, i) => {
      const [r, g, b] = c;
      return `<linearGradient id="glazeGrad${i}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgb(${up(r,55)},${up(g,55)},${up(b,55)})" stop-opacity="0.4"/>
      <stop offset="50%" stop-color="#fff" stop-opacity="0"/>
      <stop offset="100%" stop-color="rgb(${dn(r,45)},${dn(g,45)},${dn(b,45)})" stop-opacity="0.35"/>
    </linearGradient>`;
    }).join('\n    ');
    // Carved-groove shadow around each piece — a blurred duplicate of its own
    // silhouette, filter region expanded so the blur can bleed past the shape's
    // edge into the grout gap. Same technique as the azulejo adhesive template.
    const carveBlurDef = `<filter id="carveBlurOI" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="0.55"/>
    </filter>`;
    // Glazed gloss sheen — colour-independent (white-based), objectBoundingBox-
    // relative so one shared def works for every piece regardless of size.
    const glossGradDef = `<radialGradient id="glossGradOI" cx="32%" cy="26%" r="60%">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.42"/>
      <stop offset="50%" stop-color="#fff" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>`;
    const defs = `<defs>\n    ${glazeGradDefs}\n    ${carveBlurDef}\n    ${glossGradDef}\n  </defs>`;

    // Crackle tessellation in true mm-space, average piece area ≈ PX_MM² = 1cm²
    // (same granularity as the azulejo grid). Only subject pieces are drawn —
    // the background is left blank since this template is a cutting guide for
    // just the figure, not a full decorative image. Each piece is shrunk by
    // half of the "liga" so a real gap (not just a stroke) separates them.
    const GROUT_MM = 1.5;
    const cells = buildCrackleCells(gridW, gridH, fineGrid, fineGridCols, fineGridRows, PX_MM, PX_MM * 15, 90210);
    const kilnRng = mulberry32(13); // same seed as the PNG mosaic → matching kiln variation
    const pieces = cells.filter(c => c.colorIdx !== -1).map(cell => {
      const inset = insetPolygon(cell.poly, GROUT_MM / 2);
      const ptsAttr = inset.map(([x, y]) => `${(x + MARGIN).toFixed(2)},${(y + MARGIN).toFixed(2)}`).join(' ');
      // Kiln variation: jitter this piece's own colour slightly, like real
      // glazed tiles from the same batch — same idea as the PNG mosaic.
      const jitter = (kilnRng() - 0.5) * 14;
      const sat = satPalette[cell.colorIdx];
      const jr = Math.max(0, Math.min(255, sat[0] + jitter));
      const jg = Math.max(0, Math.min(255, sat[1] + jitter));
      const jb = Math.max(0, Math.min(255, sat[2] + jitter));
      const base = `rgb(${jr.toFixed(0)},${jg.toFixed(0)},${jb.toFixed(0)})`;
      return (
        `<polygon points="${ptsAttr}" fill="rgba(0,0,0,0.8)" filter="url(#carveBlurOI)"/>` +
        `<polygon points="${ptsAttr}" fill="${base}"/>` +
        `<polygon points="${ptsAttr}" fill="url(#glazeGrad${cell.colorIdx})"/>` +
        `<polygon points="${ptsAttr}" fill="url(#glossGradOI)"/>` +
        `<polygon points="${ptsAttr}" fill="none" stroke="rgba(0,0,0,0.4)" stroke-width="0.15"/>`
      );
    });

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
<title>Pixel Art — Plantilla adhesiva Opus Incertum (plóter)</title>
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
  ${defs}
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="white"/>
  <rect x="${MARGIN}" y="${MARGIN}" width="${gridW}" height="${gridH}" fill="none" stroke="#aaa" stroke-width="0.5" stroke-dasharray="3,3"/>
  ${pieces.join('\n  ')}
  ${legendItems}
  <text x="${MARGIN}" y="${(legendY + swatchSize + 5).toFixed(2)}" font-size="3.5" font-family="Arial,sans-serif" fill="#888">Opus Incertum adhesivo — ${COLS}×${ROWS} px · ${PX_MM} mm/px · ${gridW / 10}cm × ${gridH / 10}cm · escala 1:1</text>
</svg>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pixel_art_opus_incertum_ploter_adhesivo.html';
    a.click();
  }

  function downloadPopArtTemplate() {
    if (!fineGrid.length) return;

    const PX_MM = CELL_MM;
    const gridW = COLS * PX_MM;
    const gridH = ROWS * PX_MM;
    const MARGIN = 10;
    const CANVAS_W = gridW + MARGIN * 2;
    const CANVAS_H = gridH + MARGIN * 2;

    // Same tessellation as the Opus Incertum template (photo-traced boundaries,
    // pieces growing in flat regions) but rendered flat — solid saturated
    // colour + a bold outline, no glaze/gloss/kiln jitter — matching the
    // PNG's geometric pop-art look. Only subject pieces are drawn — the
    // background is left blank since this is a cutting guide for the figure.
    const satPalette = palette.map(c => saturate(c, 1.9));
    const GROUT_MM = 1.5;
    const cells = buildCrackleCells(gridW, gridH, fineGrid, fineGridCols, fineGridRows, PX_MM, PX_MM * 15, 90210);
    const pieces = cells.filter(c => c.colorIdx !== -1).map(cell => {
      const inset = insetPolygon(cell.poly, GROUT_MM / 2);
      const ptsAttr = inset.map(([x, y]) => `${(x + MARGIN).toFixed(2)},${(y + MARGIN).toFixed(2)}`).join(' ');
      const base = toHex(satPalette[cell.colorIdx]);
      return `<polygon points="${ptsAttr}" fill="${base}" stroke="#0a0a0a" stroke-width="0.6" stroke-linejoin="round"/>`;
    });

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
<title>Pixel Art — Plantilla adhesiva Pop Art Geométrico (plóter)</title>
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
  ${pieces.join('\n  ')}
  ${legendItems}
  <text x="${MARGIN}" y="${(legendY + swatchSize + 5).toFixed(2)}" font-size="3.5" font-family="Arial,sans-serif" fill="#888">Pop Art Geométrico adhesivo — ${COLS}×${ROWS} px · ${PX_MM} mm/px · ${gridW / 10}cm × ${gridH / 10}cm · escala 1:1</text>
</svg>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pixel_art_pop_art_ploter_adhesivo.html';
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

  function downloadGarbanzos() {
    const GAP  = 2;
    const BEAN = 30;
    const CELL = BEAN + GAP;

    const OW = COLS * CELL + GAP;
    const OH = ROWS * CELL + GAP;

    const cv = document.createElement('canvas');
    cv.width = OW; cv.height = OH;
    const ctx = cv.getContext('2d')!;

    // Base backing for empty (non-subject) areas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OW, OH);

    const rng = mulberry32(24601);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = pixelGrid[row * COLS + col];
        if (idx === -1) continue;
        const [r, g, b] = palette[idx];
        const x0 = col * CELL;
        const y0 = row * CELL;

        // Flat backdrop behind the bean, same colour as the pixel — gaps blend in
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x0, y0, CELL, CELL);

        const cx = x0 + GAP + BEAN / 2;
        const cy = y0 + GAP + BEAN / 2;
        const rot     = (rng() - 0.5) * Math.PI * 0.9;
        const jitter  = 0.92 + rng() * 0.12;
        drawGarbanzo(ctx, cx, cy, (BEAN / 2) * jitter, palette[idx], rot);
      }
    }

    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = 'pixel_art_garbanzos.png';
    a.click();
  }

  function downloadGravel() {
    const STONE = 30;
    const CELL  = STONE; // no grout gap — stones butt directly against each other

    const OW = COLS * CELL;
    const OH = ROWS * CELL;

    const cv = document.createElement('canvas');
    cv.width = OW; cv.height = OH;
    const ctx = cv.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OW, OH);

    const rng = mulberry32(13579);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = pixelGrid[row * COLS + col];
        if (idx === -1) continue;
        const x0 = col * CELL;
        const y0 = row * CELL;

        // Flat backdrop behind the stone, same colour as the pixel — any gap blends in
        const [r, g, b] = palette[idx];
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x0, y0, CELL, CELL);

        const cx = x0 + STONE / 2;
        const cy = y0 + STONE / 2;
        // Oversized so neighbouring stones overlap and hide any seams
        const jitter = 1.05 + rng() * 0.18;
        drawPebbleStone(ctx, cx, cy, (STONE / 2) * jitter, palette[idx], rng);
      }
    }

    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = 'pixel_art_gravilla.png';
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
        Cada píxel equivale a {CELL_MM} mm × {CELL_MM} mm en la imagen descargada.
      </p>

      <button
        onClick={downloadPaletteSheet}
        style={{
          width: '100%', padding: '0.75rem', borderRadius: 10,
          background: 'transparent', color: '#eee', fontWeight: 700,
          fontSize: '0.95rem', border: '1px solid #444', cursor: 'pointer',
          marginBottom: '1.5rem',
        }}
      >
        🖨 Descargar hoja de paleta de referencia (tamaño página, .html)
      </button>

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

      {/* Editor de paleta (opcional) */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div
          onClick={() => setShowPaletteEditor(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}
        >
          <span style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700 }}>
            {showPaletteEditor ? '▾' : '▸'} Personalizar paleta de colores (opcional)
          </span>
        </div>
        {showPaletteEditor && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: '0.75rem', color: '#777', marginBottom: 10 }}>
              Edita los {NUM_COLORS} colores que se usarán para convertir la foto. Se aplican la próxima vez que subas o reproceses una imagen.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 10, marginBottom: 12 }}>
              {customPalette.map((c, i) => {
                const hex = toHex(c);
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <input
                      type="color"
                      value={hex}
                      onChange={e => {
                        const rgb = hexToRgb(e.target.value);
                        setCustomPalette(prev => prev.map((pc, pi) => pi === i ? rgb : pc));
                      }}
                      style={{ width: 40, height: 40, border: '1px solid #444', borderRadius: 6, background: 'none', cursor: 'pointer', padding: 0 }}
                    />
                    <input
                      key={`${i}-${hex}`}
                      type="text"
                      defaultValue={hex}
                      spellCheck={false}
                      onBlur={e => {
                        const v = e.target.value.trim();
                        if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                          setCustomPalette(prev => prev.map((pc, pi) => pi === i ? hexToRgb(v) : pc));
                        } else {
                          e.target.value = hex;
                        }
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      style={{
                        width: 58, fontSize: '0.68rem', fontFamily: 'monospace', textAlign: 'center',
                        background: '#111', color: '#eee', border: '1px solid #333', borderRadius: 4, padding: '2px 4px',
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setCustomPalette(FIXED_PALETTE.map(c => [...c] as RGB))}
              style={{
                padding: '5px 14px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700,
                background: 'transparent', border: '1px solid #444', color: '#888', cursor: 'pointer',
              }}
            >
              Restablecer paleta original
            </button>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #2a2a2a' }}>
              <p style={{ fontSize: '0.78rem', color: '#999', fontWeight: 700, marginBottom: 4 }}>
                📋 Importar paleta desde texto
              </p>
              <p style={{ fontSize: '0.72rem', color: '#777', marginBottom: 8 }}>
                Pega una lista/tabla con los códigos de color (ej. "1 Azul Noche ... #0F1B3E 2 Violeta ... #3A1C5A ..."). Se toman los códigos <code>#RRGGBB</code> en el orden en que aparecen — el resto del texto se ignora.
              </p>
              <textarea
                value={paletteImportText}
                onChange={e => setPaletteImportText(e.target.value)}
                placeholder={`Tono / Nombre  Descripción  Código HEX\n1 Azul Noche...  #0F1B3E\n2 Violeta...  #3A1C5A\n...`}
                rows={4}
                style={{
                  width: '100%', fontSize: '0.72rem', fontFamily: 'monospace', resize: 'vertical',
                  background: '#111', color: '#eee', border: '1px solid #333', borderRadius: 6, padding: '8px',
                  marginBottom: 8,
                }}
              />
              <button
                onClick={applyPaletteFromText}
                style={{
                  padding: '5px 14px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700,
                  background: 'rgba(249,115,22,0.15)', border: '1px solid #f97316', color: '#f97316', cursor: 'pointer',
                }}
              >
                Aplicar paleta desde texto
              </button>
              {paletteImportStatus && (
                <p style={{ fontSize: '0.72rem', color: '#aaa', marginTop: 8 }}>{paletteImportStatus}</p>
              )}
            </div>
          </div>
        )}
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
              ⬇ Descargar PNG ({fmtCm(COLS)}cm × {fmtCm(ROWS)}cm · fondo blanco)
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
              onClick={downloadStickerTemplate}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 10,
                background: 'transparent', color: '#eee', fontWeight: 700,
                fontSize: '0.95rem', border: '1px solid #444', cursor: 'pointer',
              }}
            >
              📐 Descargar plantilla plóter adhesivo 1:1 (.html)
            </button>
            <button
              onClick={downloadOpusIncertumTemplate}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 10,
                background: 'transparent', color: '#eee', fontWeight: 700,
                fontSize: '0.95rem', border: '1px solid #444', cursor: 'pointer',
              }}
            >
              📐 Descargar plantilla plóter adhesivo Opus Incertum 1:1 (.html)
            </button>
            <button
              onClick={downloadPopArtTemplate}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 10,
                background: 'transparent', color: '#eee', fontWeight: 700,
                fontSize: '0.95rem', border: '1px solid #444', cursor: 'pointer',
              }}
            >
              📐 Descargar plantilla plóter adhesivo Pop Art 1:1 (.html)
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
              onClick={downloadOpusIncertumMosaic}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 10,
                background: 'transparent', color: '#eee', fontWeight: 700,
                fontSize: '0.95rem', border: '1px solid #444', cursor: 'pointer',
              }}
            >
              🔺 Descargar mosaico Opus Incertum (.png)
            </button>
            <button
              onClick={downloadPopArtMosaic}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 10,
                background: 'transparent', color: '#eee', fontWeight: 700,
                fontSize: '0.95rem', border: '1px solid #444', cursor: 'pointer',
              }}
            >
              🎨 Descargar Pop Art Geométrico (.png)
            </button>
            <button
              onClick={downloadStickerMosaic}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 10,
                background: 'transparent', color: '#eee', fontWeight: 700,
                fontSize: '0.95rem', border: '1px solid #444', cursor: 'pointer',
              }}
            >
              🧩 Descargar mosaico papel adhesivo (.png)
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
            <button
              onClick={downloadGarbanzos}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 10,
                background: 'transparent', color: '#eee', fontWeight: 700,
                fontSize: '0.95rem', border: '1px solid #444', cursor: 'pointer',
              }}
            >
              🫘 Descargar mosaico de garbanzos (.png)
            </button>
            <button
              onClick={downloadGravel}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 10,
                background: 'transparent', color: '#eee', fontWeight: 700,
                fontSize: '0.95rem', border: '1px solid #444', cursor: 'pointer',
              }}
            >
              🪨 Descargar mosaico de gravilla (.png)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
