'use client';
import { useEffect, useRef, useState } from 'react';

const DURATION_PRESETS = [
  { label: '15 s', value: 15 },
  { label: '30 s', value: 30 },
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
];

interface Cue { start: number; end: number; text: string }
interface LineaTiempo { start: number; end: number; text: string }

interface SceneLine { text: string; start?: number; end?: number }
interface ScenePayload { lines: SceneLine[]; searchQuery: string; duration?: number }
interface VentanaVerso { text: string; start: number; end: number }

const MIN_LINEA = 1.0; // mismo piso que usa el servidor para repartir duración por línea

// Reparte una duración total entre versos proporcionalmente al largo de su
// texto — es la MISMA lógica que usa el servidor (generate-lyric-video)
// cuando no hay tiempos reales de Deepgram (modo letra manual). Se duplica
// acá solo para poder MOSTRAR de antemano los mismos tiempos que va a usar
// el video, no para generarlo (eso lo sigue haciendo el servidor).
function repartirDuracionesLocal(textos: string[], totalDuration: number, piso: number): number[] {
  const n = textos.length;
  const pesos = textos.map(t => Math.max(t.trim().length, 10));
  const pesoTotal = pesos.reduce((a, b) => a + b, 0);
  const base = Math.min(piso, totalDuration / n);
  const restante = Math.max(totalDuration - base * n, 0);
  return pesos.map(p => base + (pesoTotal > 0 ? (p / pesoTotal) * restante : 0));
}

const formatMMSS = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

// Agrupa la letra en estrofas (bloques separados por una línea en blanco)
// — cada estrofa es UNA sola escena/búsqueda de Pexels, para no gastar una
// consulta por cada línea suelta. Si no hay líneas en blanco (letra pegada
// sin separar), cada línea queda como su propia estrofa de una sola línea.
// Se usa en el modo SIN audio (letra escrita a mano).
function agruparEstrofas(lyrics: string): string[][] {
  return lyrics
    .split(/\n\s*\n/)
    .map(bloque => bloque.split('\n').map(l => l.trim()).filter(Boolean))
    .filter(estrofa => estrofa.length > 0);
}

// Agrupa los cues (palabra por palabra, con timestamps reales de Deepgram)
// en líneas por pausas naturales — mismo criterio que usa /api/detect-sections
// para no perder la sincronía entre esa detección y el agrupado acá.
function agruparCuesEnLineas(cues: Cue[]): LineaTiempo[] {
  const lineas: LineaTiempo[] = [];
  let cur: LineaTiempo | null = null;
  for (const cue of cues) {
    if (!cur) {
      cur = { start: cue.start, end: cue.end, text: cue.text };
    } else {
      const gap = cue.start - cur.end;
      const wordCount = cur.text.split(/\s+/).length;
      if (gap > 0.8 || wordCount >= 10) {
        lineas.push(cur);
        cur = { start: cue.start, end: cue.end, text: cue.text };
      } else {
        cur.end = cue.end;
        cur.text += ' ' + cue.text;
      }
    }
  }
  if (cur) lineas.push(cur);
  return lineas;
}

const TEMAS_SUGERIDOS = ['Rancheros', 'De ciudad', 'Playa', 'Naturaleza', 'Retro / vintage', 'Nocturno / neón'];

export default function VideoLetraPage() {
  const [lyrics, setLyrics] = useState('');
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [duration, setDuration] = useState<number>(30);
  const [theme, setTheme] = useState('');

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [verseWindows, setVerseWindows] = useState<VentanaVerso[]>([]);

  const [quota, setQuota] = useState<{ limit: number; remaining: number; reset: number } | null>(null);

  useEffect(() => {
    fetch('/api/pexels-quota')
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (data && !data.error) setQuota(data); })
      .catch(() => {});
  }, []);

  const stanzas = agruparEstrofas(lyrics);
  const lines = stanzas.flat();

  const onAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const audioEl = document.createElement('audio');
    audioEl.preload = 'metadata';
    audioEl.onloadedmetadata = () => setAudioDuration(audioEl.duration);
    audioEl.src = URL.createObjectURL(file);
    setAudioFile(file);
    setDownloadUrl(null);
    setError(null);
  };

  const removeAudio = () => {
    setAudioFile(null);
    setAudioDuration(null);
  };

  const secToLabel = (s: number) => {
    if (s < 60) return `${Math.round(s)} segundos`;
    const m = Math.floor(s / 60), r = Math.round(s % 60);
    return r ? `${m} min ${r} s` : `${m} minuto${m > 1 ? 's' : ''}`;
  };

  const formatearReset = (unixSeconds: number) =>
    new Date(unixSeconds * 1000).toLocaleDateString('es-HN', { day: 'numeric', month: 'long' });

  // Transcribe el audio con Deepgram y lo agrupa en líneas por pausas
  // naturales (mismo criterio que /karaoke) — cada línea, con su tiempo
  // real, es la unidad que después busca su PROPIO clip en Pexels.
  async function transcribirYAgruparLineas(audio: File): Promise<LineaTiempo[]> {
    const form = new FormData();
    form.append('audio', audio);
    const transRes = await fetch('/api/transcribe', { method: 'POST', body: form });
    if (!transRes.ok) {
      const data = await transRes.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(data.error ?? 'No se pudo transcribir el audio');
    }
    const { cues } = await transRes.json() as { cues: Cue[] };
    if (!cues?.length) throw new Error('No se detectó letra cantada en el audio');

    const lineasConTiempo = agruparCuesEnLineas(cues);
    if (!lineasConTiempo.length) throw new Error('No se pudo agrupar la letra transcripta en líneas');
    return lineasConTiempo;
  }

  async function handleGenerate() {
    if (!audioFile && !stanzas.length) return;
    setGenerating(true);
    setError(null);
    setDownloadUrl(null);
    setVerseWindows([]);

    try {
      let versos: SceneLine[];

      if (audioFile) {
        setProgress('Transcribiendo el audio y detectando los versos…');
        versos = await transcribirYAgruparLineas(audioFile);
      } else {
        versos = lines.map(text => ({ text }));
      }

      setProgress(`Buscando una búsqueda visual para cada uno de los ${versos.length} versos…`);
      const scenesRes = await fetch('/api/lyrics-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: versos.map(v => v.text), theme: theme.trim() || undefined }),
      });
      if (!scenesRes.ok) {
        const data = await scenesRes.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(data.error ?? 'No se pudieron generar las búsquedas visuales');
      }
      const { queries } = await scenesRes.json() as { queries: string[] };

      // Cada verso es su propia "escena" de una sola línea — así cada uno
      // busca y descarga su PROPIO clip de Pexels, en vez de compartir un
      // clip con otros versos.
      // El primer verso arranca en video-time 0 aunque en el audio real
      // empiece más tarde (intro instrumental) — si no, el video entero
      // queda adelantado respecto al audio por exactamente ese intro, y la
      // letra deja de coincidir con la imagen desde ahí en adelante.
      const scenes: ScenePayload[] = versos.map((v, i) => {
        const start = i === 0 ? 0 : v.start;
        return {
          lines: [v],
          searchQuery: queries[i] ?? 'cinematic abstract background',
          duration: typeof start === 'number' && typeof v.end === 'number' ? v.end - start : undefined,
        };
      });

      // Ventanas de tiempo de cada verso en el video FINAL — reales si vienen
      // de Deepgram, o estimadas con la misma lógica que usa el servidor si
      // es letra manual. Solo para mostrarlas junto al texto y poder
      // verificar la sincronía sin tener que abrir el video.
      const duracionesParaMostrar = scenes.every(s => typeof s.duration === 'number' && (s.duration as number) > 0)
        ? scenes.map(s => s.duration as number)
        : repartirDuracionesLocal(versos.map(v => v.text), duration, MIN_LINEA);
      let acumulado = 0;
      setVerseWindows(versos.map((v, i) => {
        const d = duracionesParaMostrar[i];
        const ventana = { text: v.text, start: acumulado, end: acumulado + d };
        acumulado += d;
        return ventana;
      }));

      setProgress(`Buscando ${scenes.length} plano${scenes.length > 1 ? 's' : ''} en Pexels (uno por verso) y armando el video… (puede tardar 1-2 minutos)`);
      const form = new FormData();
      form.append('scenes', JSON.stringify(scenes));
      form.append('orientation', orientation);
      if (audioFile) {
        form.append('audio', audioFile);
      } else {
        form.append('totalDuration', String(duration));
      }

      const videoRes = await fetch('/api/generate-lyric-video', { method: 'POST', body: form });
      if (!videoRes.ok) {
        const data = await videoRes.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(data.error ?? 'Error del servidor');
      }

      setProgress('Descargando video…');
      const blob = await videoRes.blob();
      setDownloadUrl(URL.createObjectURL(blob));
      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generando el video');
      setProgress('');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="karaoke-page">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🎞️</span>
            <span className="logo-text">Video de Letra</span>
          </div>
          <a href="/admin" className="nav-btn">← Volver</a>
        </div>
      </header>

      <div className="karaoke-body" style={{ maxWidth: 640 }}>
        <h1 className="karaoke-title">Video con<span>metraje de stock</span></h1>

        {quota && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 0.75rem',
            padding: '0.55rem 0.85rem', marginBottom: '1.25rem',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--text-muted)',
          }}>
            <span style={{ whiteSpace: 'nowrap' }}>
              📊 Cupo Pexels: <strong style={{ color: 'var(--text)' }}>{quota.remaining.toLocaleString('es')}</strong> / {quota.limit.toLocaleString('es')}
            </span>
            <div style={{ flex: '1 1 80px', minWidth: 60, height: 4, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.max(2, Math.min(100, (quota.remaining / quota.limit) * 100))}%`,
                background: 'var(--accent)', borderRadius: 2,
              }} />
            </div>
            <span style={{ whiteSpace: 'nowrap' }}>Se renueva el {formatearReset(quota.reset)}</span>
          </div>
        )}

        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Subí el audio de la canción (se transcribe con Deepgram, igual que en Karaoke, y se sincroniza solo)
          o pegá la letra a mano — cada verso busca su propio clip en Pexels según lo que dice ESE verso, así
          el plano cambia línea por línea y acompaña de verdad lo que se está diciendo. Sin texto en pantalla.
        </p>

        {/* ── Letra (solo si no hay audio) ── */}
        <div className="form-group" style={{
          marginBottom: '1.25rem',
          opacity: audioFile ? 0.45 : 1, pointerEvents: audioFile ? 'none' : 'auto',
        }}>
          <label>Letra de la canción (un verso por línea)</label>
          {audioFile ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              🔒 Con audio subido, la letra y los tiempos salen de la transcripción automática.
            </p>
          ) : (
            <>
              <textarea
                value={lyrics}
                onChange={e => { setLyrics(e.target.value); setDownloadUrl(null); setError(null); }}
                placeholder={'Pegá la letra acá…\nUn verso por línea.\n\nCada verso busca su propio plano en Pexels — las líneas en blanco entre estrofas son solo para organizar el texto.'}
                rows={10}
                style={{
                  width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.92rem',
                  lineHeight: 1.6, padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)',
                }}
              />
              {lines.length > 0 && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {lines.length} verso{lines.length > 1 ? 's' : ''} → {lines.length} plano{lines.length > 1 ? 's' : ''} distintos en Pexels (uno por verso)
                </span>
              )}
            </>
          )}
        </div>

        {/* ── Tema / ambientación (opcional) ── */}
        <div style={{
          width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.25rem',
        }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Tema / ambientación (opcional)
          </p>
          <input
            type="text"
            value={theme}
            onChange={e => setTheme(e.target.value)}
            placeholder="Ej. rancheros, de ciudad, playa, retro…"
            style={{
              width: '100%', fontFamily: 'inherit', fontSize: '0.9rem',
              padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)',
              marginBottom: '0.75rem',
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {TEMAS_SUGERIDOS.map(t => (
              <button
                key={t}
                className={`kk-btn${theme === t ? ' primary' : ''}`}
                style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                onClick={() => setTheme(theme === t ? '' : t)}
              >{t}</button>
            ))}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.6rem', marginBottom: 0 }}>
            Sesga las búsquedas de Pexels hacia esa ambientación en todos los versos. Dejalo vacío para que la IA elija libremente según la letra.
          </p>
        </div>

        {/* ── Orientación ── */}
        <div style={{
          width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.25rem',
        }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Orientación del video
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`kk-btn${orientation === 'vertical' ? ' primary' : ''}`}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', padding: '10px' }}
              onClick={() => setOrientation('vertical')}
            >
              <span style={{ fontSize: '1.2rem' }}>📱</span>
              <span>Vertical (9:16)</span>
            </button>
            <button
              className={`kk-btn${orientation === 'horizontal' ? ' primary' : ''}`}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', padding: '10px' }}
              onClick={() => setOrientation('horizontal')}
            >
              <span style={{ fontSize: '1.2rem' }}>🖥️</span>
              <span>Horizontal (16:9)</span>
            </button>
          </div>
        </div>

        {/* ── Audio ── */}
        <div style={{
          width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.25rem',
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
        }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0' }}>
            Audio (recomendado — sincroniza letra y tiempos solo)
          </p>
          {!audioFile ? (
            <button className="kk-btn" style={{ alignSelf: 'flex-start' }} onClick={() => audioInputRef.current?.click()}>
              🎵 Subir audio de la canción
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
              <span>🎵 {audioFile.name}</span>
              {audioDuration != null && <span style={{ color: 'var(--text-muted)' }}>({secToLabel(audioDuration)})</span>}
              <button onClick={removeAudio} className="kk-btn" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                Quitar
              </button>
            </div>
          )}
          <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={onAudioChange} />

          {/* ── Duración (solo si no hay audio) ── */}
          {!audioFile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Duración total del video</span>
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
                  type="range" min={5} max={180} value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--accent)' }}
                />
                <span style={{ minWidth: 90, fontSize: '0.88rem', fontWeight: 600, color: 'var(--accent-soft)', textAlign: 'right' }}>
                  {secToLabel(duration)}
                </span>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              🔒 Letra, tiempos y duración se toman de la transcripción del audio subido ({audioDuration != null ? secToLabel(audioDuration) : '…'})
            </p>
          )}
        </div>

        {/* ── Botón generar ── */}
        <button
          className="btn-primary"
          onClick={handleGenerate}
          disabled={generating || (!audioFile && !stanzas.length)}
          style={{ alignSelf: 'flex-start', marginBottom: '1rem' }}
        >
          {generating ? '⏳ Generando…' : '🎞️ Generar video'}
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
            <a href={downloadUrl} download="video_letra.mp4" className="btn-primary"
              style={{ display: 'inline-block', textDecoration: 'none' }}>
              ⬇️ Descargar MP4
            </a>
            <video src={downloadUrl} controls playsInline style={{
              display: 'block', marginTop: '1rem', maxHeight: 400,
              borderRadius: 8, border: '1px solid var(--border)', background: '#000',
            }} />
          </div>
        )}

        {/* ── Versos con sus tiempos, para verificar la sincronía ── */}
        {verseWindows.length > 0 && (
          <div style={{
            padding: '1rem 1.25rem', borderRadius: 'var(--radius)',
            background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: '1rem',
          }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
              Versos y sus tiempos en el video
            </p>
            <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {verseWindows.map((v, i) => (
                <li key={i} style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
                  {v.text} <span style={{ color: 'var(--text-muted)' }}>({formatMMSS(v.start)}–{formatMMSS(v.end)})</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="kk-info" style={{ marginTop: '2rem' }}>
          <strong>Cómo funciona:</strong><br />
          <strong>Con audio</strong> — se transcribe con Deepgram (como en Karaoke) y se agrupa en versos por pausas
          naturales, cada uno con su tiempo real.<br />
          <strong>Sin audio</strong> — cada línea que escribís es un verso, y la duración se reparte proporcional
          al largo del texto.<br />
          En ambos casos: la IA genera una búsqueda en inglés específica para CADA verso (según lo que ese verso
          dice, no un tema genérico compartido) y Pexels busca un clip para cada una — un plano distinto por
          verso, sincronizado con lo que se está diciendo en ese momento. No se quema texto sobre el video.<br />
          Esto gasta 1 consulta de Pexels por verso (mirá el cupo arriba). Si elegís un
          <strong> tema/ambientación</strong>, todas las búsquedas se sesgan hacia ese estilo (ej. rancheros,
          ciudad) — Pexels es metraje real, así que esto funciona para temas/ambientaciones concretas, no para
          estilos de dibujo o animación (cómic, manga).
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
