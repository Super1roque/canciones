'use client';
import { useState, useRef, useEffect } from 'react';

// Physical: each brick = 15mm × 15mm (2×2 studs per brick)
// Canvas: 4×4 ft = 48"×48" = 1219.2mm × 1219.2mm
// Grid: 81 cols × 81 rows = 6,561 bricks
const COLS = 81;
const ROWS = 81;
const NUM_COLORS = 8;
const SIDE_SCREEN = 9; // px per brick in preview → 729×729px

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

type RGB = [number, number, number];
type LAB = [number, number, number];
type Grid = number[];

// ── Color helpers ─────────────────────────────────────────────────────────────
function rgbToLab(rgb: RGB): LAB {
  let r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
  r = r > 0.04045 ? ((r + 0.055) / 1.055) ** 2.4 : r / 12.92;
  g = g > 0.04045 ? ((g + 0.055) / 1.055) ** 2.4 : g / 12.92;
  b = b > 0.04045 ? ((b + 0.055) / 1.055) ** 2.4 : b / 12.92;
  let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  let y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) / 1.00000;
  let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;
  const f = (t: number) => t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function labDist(a: LAB, b: LAB): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function toHex(c: RGB) { return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); }
function luminance(c: RGB) { return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }

// ── Lego brick renderer (2×2 studs) ──────────────────────────────────────────
function drawLegoBrick(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, color: string) {
  const GAP = 0;
  const bx = x + GAP, by = y + GAP;
  const bs = cell - GAP * 2;

  // Base color
  ctx.fillStyle = color;
  ctx.fillRect(bx, by, bs, bs);

  // Top-left bevel highlight
  const hl = ctx.createLinearGradient(bx, by, bx + bs * 0.55, by + bs * 0.55);
  hl.addColorStop(0, 'rgba(255,255,255,0.38)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(bx, by, bs, bs);

  // Bottom-right bevel shadow
  const sh = ctx.createLinearGradient(bx + bs, by + bs, bx + bs * 0.45, by + bs * 0.45);
  sh.addColorStop(0, 'rgba(0,0,0,0.32)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(bx, by, bs, bs);

  // 4 studs arranged in 2×2 grid
  const R = cell * 0.16;
  const offsets = [
    [x + cell * 0.28, y + cell * 0.28],
    [x + cell * 0.72, y + cell * 0.28],
    [x + cell * 0.28, y + cell * 0.72],
    [x + cell * 0.72, y + cell * 0.72],
  ];
  for (const [cx, cy] of offsets) {
    // Shadow
    ctx.beginPath(); ctx.arc(cx + R * 0.22, cy + R * 0.22, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.20)'; ctx.fill();
    // Base
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    // Highlight
    const sg = ctx.createRadialGradient(cx - R * 0.32, cy - R * 0.38, 0, cx, cy, R);
    sg.addColorStop(0, 'rgba(255,255,255,0.55)');
    sg.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LegoArtPage() {
  const fileRef   = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [phase,     setPhase]     = useState<'idle' | 'removing' | 'processing' | 'done' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [pixelGrid, setPixelGrid] = useState<Grid>([]);
  const [palette,   setPalette]   = useState<RGB[]>([]);
  const [counts,    setCounts]    = useState<number[]>([]);
  const [fileName,  setFileName]  = useState('');
  const [removeBg,  setRemoveBg]  = useState(false);

  const canvasW = COLS * SIDE_SCREEN;
  const canvasH = ROWS * SIDE_SCREEN;

  // Preview: flat colored squares (fast redraw)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || phase !== 'done') return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = pixelGrid[row * COLS + col];
        if (idx === -1) continue;
        const [r, g, b] = FIXED_PALETTE[idx];
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(col * SIDE_SCREEN + 1, row * SIDE_SCREEN + 1, SIDE_SCREEN - 1, SIDE_SCREEN - 1);
      }
    }
  }, [pixelGrid, palette, phase]);

  // ── Image processing ──────────────────────────────────────────────────────
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
    const url       = URL.createObjectURL(sourceBlob ?? file);
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

      const palLab = FIXED_PALETTE.map(rgbToLab);
      const grid: Grid = [];
      const cnt = Array(NUM_COLORS).fill(0);

      for (let i = 0; i < COLS * ROWS; i++) {
        const alpha = data[i * 4 + 3];
        if (bgRemoved && alpha <= 128) { grid.push(-1); continue; }
        const px: RGB = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
        const pxLab = rgbToLab(px);
        let minD = Infinity, minI = 0;
        for (let j = 0; j < NUM_COLORS; j++) {
          const d = labDist(pxLab, palLab[j]);
          if (d < minD) { minD = d; minI = j; }
        }
        grid.push(minI);
        cnt[minI]++;
      }

      if (grid.every(i => i === -1)) {
        setPhase('error');
        setStatusMsg('No se encontró sujeto en la imagen.');
        return;
      }

      setPalette(FIXED_PALETTE);
      setPixelGrid(grid);
      setCounts(cnt);
      setPhase('done');
    };
    img.src = url;
  }

  // ── Download PNG (Lego bricks with studs) ────────────────────────────────
  function downloadImage() {
    if (!pixelGrid.length) return;
    const CELL = 28; // px per brick → 1120×2268px = ~2.5M pixels
    const W = COLS * CELL, H = ROWS * CELL;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, W, H);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = pixelGrid[row * COLS + col];
        if (idx === -1) continue;
        drawLegoBrick(ctx, col * CELL, row * CELL, CELL, toHex(FIXED_PALETTE[idx]));
      }
    }
    cv.toBlob(blob => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'lego_art.png';
      a.click();
    });
  }

  // ── Download HTML guide ───────────────────────────────────────────────────
  function downloadGuide() {
    if (!pixelGrid.length) return;
    const subj = counts.reduce((s, c) => s + c, 0);
    const S = 13; // px per brick in SVG guide

    let svgBody = '';
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = pixelGrid[row * COLS + col];
        const rx = col * S + 1, ry = row * S + 1;
        if (idx === -1) {
          svgBody += `<rect x="${rx}" y="${ry}" width="${S - 1}" height="${S - 1}" fill="#f0f0f0" stroke="#ddd" stroke-width="0.3"/>`;
        } else {
          const hex = toHex(FIXED_PALETTE[idx]);
          const txt = luminance(FIXED_PALETTE[idx]) > 128 ? '#000' : '#fff';
          svgBody += `<rect x="${rx}" y="${ry}" width="${S - 1}" height="${S - 1}" fill="${hex}" stroke="#555" stroke-width="0.3"/>`;
          svgBody += `<text x="${rx + (S - 1) / 2}" y="${ry + (S - 1) / 2 + 1}" text-anchor="middle" dominant-baseline="middle" font-size="7" font-family="monospace" font-weight="bold" fill="${txt}">${idx + 1}</text>`;
        }
      }
    }

    const svgW = COLS * S + 2, svgH = ROWS * S + 2;

    const paletteHtml = FIXED_PALETTE.map((c, i) => {
      const hex = toHex(c);
      const pct = ((counts[i] / subj) * 100).toFixed(1);
      const txt = luminance(c) > 128 ? '#000' : '#fff';
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;background:${hex};border:1px solid rgba(0,0,0,0.2);border-radius:3px;font-size:12px;font-weight:900;color:${txt};font-family:monospace">${i + 1}</span>
        <span style="font-family:monospace;font-size:13px;font-weight:700">${hex}</span>
        <span style="color:#666;font-size:12px">— ${counts[i]} bricks (${pct}%)</span>
      </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Guía Lego Art ${COLS}×${ROWS}</title>
<style>
  body { font-family:sans-serif; margin:40px 20px; color:#333; }
  h1 { font-size:1.3rem; margin:0 0 4px; }
  h2 { font-size:1rem; margin:16px 0 6px; color:#555; }
  svg { display:block; max-width:100%; height:auto; }
  .print-btn { display:inline-block;margin-bottom:16px;padding:8px 20px;background:#333;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;font-family:sans-serif; }
  @media print { .print-btn { display:none; } body { margin:0; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨 Imprimir / Guardar como PDF</button>
  <h1>Guía Lego Art — ${COLS}×${ROWS} bricks · ${NUM_COLORS} colores</h1>
  <p style="color:#888;font-size:12px;margin:0 0 12px">Brick: 15 mm × 15 mm · 4 studs (2×2) · lienzo 4×4 ft (121.92 × 121.92 cm)</p>
  <h2>Paleta</h2>
  ${paletteHtml}
  <h2>Mapa de bricks</h2>
  <svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}">
    <rect width="${svgW}" height="${svgH}" fill="#fff"/>
    ${svgBody}
  </svg>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lego_art_guia.html';
    a.click();
  }

  // ── Download 1:1 plotter template ────────────────────────────────────────
  function downloadTemplate() {
    if (!pixelGrid.length) return;
    const BRICK_MM = 15;
    const CANVAS_W = 1219.2;  // 48" in mm (4 ft)
    const CANVAS_H = 1219.2;  // 48" in mm (4 ft)
    const gridW = COLS * BRICK_MM; // 600mm
    const gridH = ROWS * BRICK_MM; // 1215mm
    const marginL = (CANVAS_W - gridW) / 2; // 4.8mm
    const marginT = (CANVAS_H - gridH) / 2; // 2.1mm

    let svgBody = '';
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = pixelGrid[row * COLS + col];
        const rx = (marginL + col * BRICK_MM).toFixed(3);
        const ry = (marginT + row * BRICK_MM).toFixed(3);
        const isSubject = idx !== -1;
        const fill = isSubject ? toHex(FIXED_PALETTE[idx]) : 'none';
        const textColor = isSubject && luminance(FIXED_PALETTE[idx]) < 128 ? '#fff' : '#333';
        svgBody += `<rect x="${rx}" y="${ry}" width="${BRICK_MM}" height="${BRICK_MM}" fill="${fill}" stroke="#555" stroke-width="0.2"/>`;
        if (isSubject) {
          const cx = (marginL + col * BRICK_MM + BRICK_MM / 2).toFixed(2);
          const cy = (marginT + row * BRICK_MM + BRICK_MM / 2 + 1.5).toFixed(2);
          svgBody += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="5" font-family="Arial,sans-serif" fill="${textColor}">${idx + 1}</text>`;
        }
      }
    }

    const swatchSize = 8;
    const legendY = marginT + gridH + 4;
    const legendItems = FIXED_PALETTE.map((c, i) => {
      const lx = marginL + i * (swatchSize + 14);
      return `<rect x="${lx}" y="${legendY}" width="${swatchSize}" height="${swatchSize}" fill="${toHex(c)}" stroke="#333" stroke-width="0.3"/>` +
             `<text x="${lx + swatchSize + 2}" y="${(legendY + swatchSize / 2 + 1.5).toFixed(1)}" font-size="5" font-family="Arial,sans-serif" fill="#333">${i + 1}</text>`;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Lego Art — Plantilla 1:1 (plóter 48")</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; }
  @page { size: ${CANVAS_W}mm ${CANVAS_H}mm; margin: 0; }
  .no-print { position: fixed; top: 10px; left: 10px; z-index: 999; background: #f97316; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; font-family: sans-serif; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
<button class="no-print" onclick="window.print()">🖨 Imprimir en plóter 48"</button>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${CANVAS_W}mm" height="${CANVAS_H}mm"
     viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="white"/>
  <rect x="${marginL.toFixed(3)}" y="${marginT.toFixed(3)}" width="${gridW}" height="${gridH}" fill="none" stroke="#aaa" stroke-width="0.5" stroke-dasharray="3,3"/>
  ${svgBody}
  ${legendItems}
  <text x="${marginL.toFixed(2)}" y="${(legendY + swatchSize + 6).toFixed(2)}" font-size="4" font-family="Arial,sans-serif" fill="#888">Lego Art — brick 15 mm × 15 mm · ${COLS}×${ROWS} bricks · lienzo 4×4 ft (${CANVAS_W}×${CANVAS_H} mm) · escala 1:1</text>
</svg>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lego_art_plantilla_ploter.html';
    a.click();
  }

  const subjectTotal = counts.reduce((s, c) => s + c, 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'sans-serif', color: '#eee' }}>
      <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: '#888', textDecoration: 'none', marginBottom: '1.5rem' }}>
        ← Volver al menú
      </a>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.3rem' }}>🟥 Convertidor Lego Art</h1>
      <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '2rem' }}>
        Convierte una foto a {COLS}×{ROWS} bricks Lego con {NUM_COLORS} colores sólidos.<br />
        Cada brick: 15 mm × 15 mm · 4 studs (2×2). Lienzo: 4×4 ft (121.92 × 121.92 cm).
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

      {/* Upload area */}
      <div
        onClick={() => (phase === 'idle' || phase === 'done' || phase === 'error') ? fileRef.current?.click() : undefined}
        style={{
          border: '2px dashed #333', borderRadius: 12, padding: '2rem',
          textAlign: 'center',
          cursor: (phase === 'idle' || phase === 'done' || phase === 'error') ? 'pointer' : 'default',
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
          {/* Preview */}
          <div style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.5rem' }}>
              Vista previa — {COLS}×{ROWS} bricks · {subjectTotal} bricks de sujeto
            </div>
            <canvas
              ref={canvasRef}
              width={canvasW}
              height={canvasH}
              style={{ border: '1px solid #333', display: 'block', background: '#111', maxWidth: '100%', height: 'auto' }}
            />
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
                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{hex} — {counts[i]} bricks</span>
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

          {/* Downloads */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={downloadImage}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 10,
                background: '#f97316', color: '#fff', fontWeight: 700,
                fontSize: '0.95rem', border: 'none', cursor: 'pointer',
              }}
            >
              ⬇ Descargar PNG ({COLS}×{ROWS} bricks · con relieve)
            </button>
            <button
              onClick={downloadGuide}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 10,
                background: 'transparent', color: '#eee', fontWeight: 700,
                fontSize: '0.95rem', border: '1px solid #444', cursor: 'pointer',
              }}
            >
              📄 Descargar guía fila por fila (.html)
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
          </div>
        </>
      )}
    </div>
  );
}
