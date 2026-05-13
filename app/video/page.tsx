'use client';
import { useState, useRef, useCallback } from 'react';

interface PhotoItem {
  id: string;
  file: File;
  preview: string;
}

const TRANSITIONS = [
  { value: 'random',      label: 'Aleatoria',    icon: '🎲' },
  { value: 'fade_black',  label: 'Fade negro',   icon: '⬛' },
  { value: 'fade_white',  label: 'Fade blanco',  icon: '⬜' },
  { value: 'hard_cut',    label: 'Corte seco',   icon: '✂️' },
  { value: 'slide_left',  label: 'Slide ←',      icon: '⬅️' },
  { value: 'slide_right', label: 'Slide →',      icon: '➡️' },
  { value: 'slide_up',    label: 'Slide ↑',      icon: '⬆️' },
  { value: 'slide_down',  label: 'Slide ↓',      icon: '⬇️' },
];

const DURATION_PRESETS = [
  { label: '15 s', value: 15 },
  { label: '30 s', value: 30 },
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
];

export default function VideoPage() {
  const [photos, setPhotos]           = useState<PhotoItem[]>([]);
  const [dragging, setDragging]       = useState(false);
  const [generating, setGenerating]   = useState(false);
  const [progress, setProgress]       = useState('');
  const [error, setError]             = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // ── Modo duración ────────────────────────────────────────────────────
  const [mode, setMode]               = useState<'total' | 'repeat'>('total');
  const [duration, setDuration]       = useState<number>(30);
  const [secPerPhoto, setSecPerPhoto] = useState<number>(5);
  const [repetitions, setRepetitions] = useState<number>(2);

  // ── Transición ───────────────────────────────────────────────────────
  const [transition, setTransition]   = useState<string>('fade_black');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Duración total calculada según el modo activo
  const totalDuration = mode === 'total'
    ? duration
    : secPerPhoto * photos.length * repetitions;

  const secPerPhotoEffective = photos.length
    ? (mode === 'total' ? duration / photos.length : secPerPhoto)
    : 0;

  // ── Agregar fotos ─────────────────────────────────────────────────────
  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!arr.length) return;
    const items: PhotoItem[] = arr.map(f => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      file: f,
      preview: URL.createObjectURL(f),
    }));
    setPhotos(prev => [...prev, ...items]);
    setDownloadUrl(null);
    setError(null);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  };
  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files);
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => {
      const item = prev.find(p => p.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter(p => p.id !== id);
    });
  };

  const movePhoto = (id: string, dir: -1 | 1) => {
    setPhotos(prev => {
      const idx = prev.findIndex(p => p.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  // ── Generar video ─────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!photos.length) return;
    setGenerating(true);
    setError(null);
    setDownloadUrl(null);
    setProgress('Enviando fotos al servidor…');

    try {
      const form = new FormData();
      form.append('transition', transition);

      if (mode === 'repeat') {
        // En modo repetición, mandamos las fotos N veces en orden
        const reps = Math.max(1, repetitions);
        for (let r = 0; r < reps; r++) {
          for (const p of photos) form.append('photos', p.file);
        }
        form.append('duration', String(secPerPhoto * photos.length * reps));
      } else {
        for (const p of photos) form.append('photos', p.file);
        form.append('duration', String(duration));
      }

      setProgress('Generando video con FFmpeg… (puede tardar unos segundos)');
      const res  = await fetch('/api/generate-video', { method: 'POST', body: form });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(data.error ?? 'Error del servidor');
      }

      setProgress('Descargando video…');
      const blob = await res.blob();
      setDownloadUrl(URL.createObjectURL(blob));
      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generando el video');
      setProgress('');
    } finally {
      setGenerating(false);
    }
  }

  const secToLabel = (s: number) => {
    if (s < 60) return `${Math.round(s)} segundos`;
    const m = Math.floor(s / 60), r = Math.round(s % 60);
    return r ? `${m} min ${r} s` : `${m} minuto${m > 1 ? 's' : ''}`;
  };

  return (
    <div className="karaoke-page">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🎬</span>
            <span className="logo-text">Video Generator</span>
          </div>
          <a href="/" className="nav-btn">← Volver</a>
        </div>
      </header>

      <div className="karaoke-body" style={{ maxWidth: 640 }}>
        <h1 className="karaoke-title">Carrusel<span>de fotos</span></h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Sube tus fotos, elige la duración y genera un video vertical 9:16.
        </p>

        {/* ── Zona de carga ── */}
        <div
          className={`kk-drop${dragging ? ' kk-drop-active' : ''}`}
          style={{
            width: '100%', minHeight: 120, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            fontSize: '0.9rem', marginBottom: '1.25rem', cursor: 'pointer',
            borderColor: dragging ? '#7c5cfc' : undefined,
            color: dragging ? '#7c5cfc' : undefined,
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <span style={{ fontSize: '2rem' }}>🖼️</span>
          <span>Arrastra fotos aquí o <strong>haz clic para seleccionar</strong></span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            JPG, PNG, WEBP… Múltiples archivos permitidos
          </span>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple
          style={{ display: 'none' }} onChange={onFileChange} />

        {/* ── Grid de miniaturas ── */}
        {photos.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: '0.75rem', marginBottom: '1.5rem',
          }}>
            {photos.map((p, idx) => (
              <div key={p.id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{
                  aspectRatio: '9/16', background: '#111',
                  borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)',
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt={p.file.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{
                  position: 'absolute', top: 5, left: 5,
                  background: 'rgba(0,0,0,0.7)', color: '#fff',
                  borderRadius: 4, padding: '1px 6px', fontSize: '0.75rem', fontWeight: 700,
                }}>{idx + 1}</div>
                <div style={{ position: 'absolute', top: 5, right: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <button onClick={() => movePhoto(p.id, -1)} disabled={idx === 0} style={thumbBtn} title="Mover arriba">↑</button>
                  <button onClick={() => movePhoto(p.id, 1)} disabled={idx === photos.length - 1} style={thumbBtn} title="Mover abajo">↓</button>
                  <button onClick={() => removePhoto(p.id)} style={{ ...thumbBtn, background: 'rgba(220,50,50,0.85)' }} title="Eliminar">✕</button>
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '3px 4px', wordBreak: 'break-all', lineHeight: 1.2 }}>
                  {p.file.name.length > 20 ? p.file.name.slice(0, 18) + '…' : p.file.name}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Modo: duración total vs repetición ── */}
        <div style={{
          width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem',
          display: 'flex', flexDirection: 'column', gap: '1.25rem',
        }}>
          {/* Toggle */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`kk-btn${mode === 'total' ? ' primary' : ''}`}
              style={{ flex: 1, fontSize: '0.85rem' }}
              onClick={() => setMode('total')}
            >
              ⏱ Duración total
            </button>
            <button
              className={`kk-btn${mode === 'repeat' ? ' primary' : ''}`}
              style={{ flex: 1, fontSize: '0.85rem' }}
              onClick={() => setMode('repeat')}
            >
              🔁 Repetir fotos
            </button>
          </div>

          {/* ── Modo duración total ── */}
          {mode === 'total' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {DURATION_PRESETS.map(preset => (
                  <button
                    key={preset.value}
                    className={`kk-btn${duration === preset.value ? ' primary' : ''}`}
                    style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                    onClick={() => setDuration(preset.value)}
                  >{preset.label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="range" min={3} max={300} value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--accent)' }}
                />
                <span style={{ minWidth: 90, fontSize: '0.88rem', fontWeight: 600, color: 'var(--accent-soft)', textAlign: 'right' }}>
                  {secToLabel(duration)}
                </span>
              </div>
              {photos.length > 0 && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {photos.length} foto{photos.length > 1 ? 's' : ''} · <strong style={{ color: 'var(--text)' }}>{secPerPhotoEffective.toFixed(1)} s</strong> por foto
                </span>
              )}
            </div>
          )}

          {/* ── Modo repetición ── */}
          {mode === 'repeat' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Segundos por foto */}
              <div className="form-group">
                <label>Segundos por foto</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="range" min={1} max={30} value={secPerPhoto}
                    onChange={e => setSecPerPhoto(Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent)' }}
                  />
                  <span style={{ minWidth: 50, fontSize: '1rem', fontWeight: 700, color: 'var(--accent-soft)', textAlign: 'right' }}>
                    {secPerPhoto} s
                  </span>
                </div>
              </div>

              {/* Repeticiones */}
              <div className="form-group">
                <label>¿Cuántas veces se repiten las fotos?</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="range" min={1} max={10} value={repetitions}
                    onChange={e => setRepetitions(Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent)' }}
                  />
                  <span style={{ minWidth: 50, fontSize: '1rem', fontWeight: 700, color: 'var(--accent-soft)', textAlign: 'right' }}>
                    {repetitions}×
                  </span>
                </div>
              </div>

              {/* Resumen */}
              {photos.length > 0 && (
                <div style={{
                  background: 'var(--surface2)', borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem 1rem', fontSize: '0.85rem', lineHeight: 1.8,
                }}>
                  <div>📸 {photos.length} foto{photos.length > 1 ? 's' : ''} × {secPerPhoto} s × {repetitions} repeticion{repetitions > 1 ? 'es' : ''}</div>
                  <div style={{ fontWeight: 700, color: 'var(--accent-soft)', fontSize: '1rem' }}>
                    = {secToLabel(totalDuration)} de video
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Tipo de transición ── */}
        <div style={{
          width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem',
        }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Tipo de transición
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem' }}>
            {TRANSITIONS.map(t => (
              <button
                key={t.value}
                className={`kk-btn${transition === t.value ? ' primary' : ''}`}
                style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: '0.2rem', padding: '8px 10px' }}
                onClick={() => setTransition(t.value)}
              >
                <span style={{ fontSize: '1.2rem' }}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Botón generar ── */}
        <button
          className="btn-primary"
          onClick={handleGenerate}
          disabled={generating || !photos.length}
          style={{ alignSelf: 'flex-start', marginBottom: '1rem' }}
        >
          {generating ? '⏳ Generando…' : '🎬 Generar video'}
        </button>

        {/* ── Progreso ── */}
        {progress && (
          <div style={{
            padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)',
            background: 'rgba(124,92,252,0.1)', border: '1px solid var(--accent)',
            color: 'var(--accent-soft)', fontSize: '0.88rem', marginBottom: '1rem',
            display: 'flex', alignItems: 'center', gap: '0.6rem',
          }}>
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
            {progress}
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div style={{
            padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)',
            background: 'rgba(248,113,113,0.1)', border: '1px solid #f87171',
            color: '#f87171', fontSize: '0.88rem', marginBottom: '1rem',
          }}>
            ❌ {error}
          </div>
        )}

        {/* ── Descarga ── */}
        {downloadUrl && (
          <div style={{
            padding: '1rem 1.25rem', borderRadius: 'var(--radius)',
            background: 'rgba(74,222,128,0.08)', border: '1px solid #4ade80', marginBottom: '1rem',
          }}>
            <p style={{ color: '#4ade80', fontWeight: 600, marginBottom: '0.75rem' }}>✅ Video listo</p>
            <a href={downloadUrl} download="video_canciones.mp4" className="btn-primary"
              style={{ display: 'inline-block', textDecoration: 'none' }}>
              ⬇️ Descargar MP4
            </a>
            <video src={downloadUrl} controls playsInline style={{
              display: 'block', marginTop: '1rem', maxHeight: 400,
              borderRadius: 8, border: '1px solid var(--border)', background: '#000',
            }} />
          </div>
        )}

        <div className="kk-info" style={{ marginTop: '2rem' }}>
          <strong>Modos de duración:</strong><br />
          <strong>⏱ Duración total</strong> — defines cuánto dura el video y las fotos se reparten igualmente.<br />
          <strong>🔁 Repetir fotos</strong> — defines cuántos segundos dura cada foto y cuántas veces se repite el ciclo completo.
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .kk-drop-active { border-color: var(--accent) !important; color: var(--accent) !important; }
      `}</style>
    </div>
  );
}

const thumbBtn: React.CSSProperties = {
  background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff',
  borderRadius: 4, width: 22, height: 22, cursor: 'pointer',
  fontSize: '0.75rem', display: 'flex', alignItems: 'center',
  justifyContent: 'center', padding: 0,
};
