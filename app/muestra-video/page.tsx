'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Stage = 'idle' | 'generating' | 'done' | 'error';

const STEPS = [
  { label: 'Leyendo archivos',   pct: 15 },
  { label: 'Escalando imagen',   pct: 35 },
  { label: 'Renderizando texto', pct: 55 },
  { label: 'Codificando video',  pct: 80 },
  { label: 'Finalizando MP4',    pct: 95 },
];

function ProgressGraph({ active }: { active: boolean }) {
  const [pct, setPct]       = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) {
      setPct(0);
      setStepIdx(0);
      return;
    }

    let current = 0;
    let sIdx    = 0;

    function advance() {
      if (sIdx >= STEPS.length) return;
      const target = STEPS[sIdx].pct;
      setStepIdx(sIdx);

      function tick() {
        current += 1;
        setPct(current);
        if (current < target) {
          timerRef.current = setTimeout(tick, 80 + Math.random() * 60);
        } else {
          sIdx++;
          // Pausa entre etapas
          timerRef.current = setTimeout(advance, 600 + Math.random() * 400);
        }
      }
      tick();
    }

    advance();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [active]);

  // Barras de ecualizador animadas
  const bars = Array.from({ length: 18 }, (_, i) => i);

  return (
    <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)' }}>

      {/* Ecualizador */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 5, height: 56, marginBottom: '1.25rem' }}>
        {bars.map(i => (
          <div
            key={i}
            style={{
              width: 10,
              borderRadius: 3,
              background: `linear-gradient(to top, #f97316, #ef4444)`,
              animation: active ? `eq-bar ${0.4 + (i % 5) * 0.15}s ease-in-out infinite alternate` : 'none',
              height: active ? undefined : 4,
              animationDelay: `${i * 0.05}s`,
              // fallback height when not animating
              minHeight: 4,
            }}
          />
        ))}
      </div>

      {/* Barra de progreso */}
      <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, height: 8, overflow: 'hidden', marginBottom: '0.75rem' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: 'linear-gradient(to right, #f97316, #ef4444)',
          borderRadius: 6,
          transition: 'width 0.15s ease',
        }} />
      </div>

      {/* Etiqueta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
          {active ? STEPS[Math.min(stepIdx, STEPS.length - 1)].label : ''}
        </span>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f97316' }}>
          {active ? `${pct}%` : ''}
        </span>
      </div>

      <style>{`
        @keyframes eq-bar {
          from { height: 6px; }
          to   { height: 52px; }
        }
      `}</style>
    </div>
  );
}

export default function MuestraVideoPage() {
  const router = useRouter();
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [text, setText]           = useState('');
  const [stage, setStage]         = useState<Stage>('idle');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const audioRef = useRef<HTMLInputElement>(null);

  function onAudioChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setAudioFile(f);
    setDownloadUrl(null);
    setError(null);
    e.target.value = '';
  }

  async function generate() {
    if (!audioFile) return;
    setStage('generating');
    setError(null);
    setDownloadUrl(null);
    try {
      const form = new FormData();
      form.append('audio', audioFile);
      form.append('text', text);
      const res = await fetch('/api/generate-sample-video', { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
      }
      const blob = await res.blob();
      setDownloadUrl(URL.createObjectURL(blob));
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setStage('error');
    }
  }

  const ready = !!audioFile;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0c0c18',
      color: '#fff',
      fontFamily: 'Inter, sans-serif',
      padding: '2rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: 520 }}>

        {/* Botón regresar */}
        <button
          onClick={() => router.back()}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
            fontSize: '0.85rem', padding: '0.45rem 0.9rem', marginBottom: '1.5rem',
          }}
        >
          ← Regresar
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎬</div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Muestra de Video</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginTop: '0.4rem', fontSize: '0.88rem' }}>
            Audio + texto → MP4 vertical 9:16 con animación mariachi
          </p>
        </div>

        {/* Audio */}
        <Section label="Audio" icon="🎵">
          <UploadButton
            label={audioFile ? audioFile.name : 'Seleccionar audio'}
            accept="audio/*"
            inputRef={audioRef}
            onChange={onAudioChange}
            active={!!audioFile}
          />
          {audioFile && (
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.3rem' }}>
              {(audioFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
        </Section>

        {/* Texto */}
        <Section label="Texto en el video" icon="✍️">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Texto que aparecerá sobre la imagen…"
            rows={3}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
              padding: '0.75rem 1rem',
              color: '#fff',
              fontSize: '0.92rem',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </Section>

        {/* Botón */}
        <button
          onClick={generate}
          disabled={!ready || stage === 'generating'}
          style={{
            width: '100%',
            marginTop: '1.25rem',
            padding: '0.9rem',
            borderRadius: 12,
            border: 'none',
            background: ready && stage !== 'generating'
              ? 'linear-gradient(135deg, #f97316, #ef4444)'
              : 'rgba(255,255,255,0.08)',
            color: ready && stage !== 'generating' ? '#fff' : 'rgba(255,255,255,0.3)',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: ready && stage !== 'generating' ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s',
          }}
        >
          {stage === 'generating' ? '⏳ Generando…' : '🎬 Generar video mariachi'}
        </button>

        {/* Gráfica de progreso */}
        <ProgressGraph active={stage === 'generating'} />

        {/* Error */}
        {stage === 'error' && error && (
          <div style={{
            marginTop: '1.25rem',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10,
            padding: '0.9rem 1rem',
            color: '#fca5a5',
            fontSize: '0.88rem',
          }}>
            {error}
          </div>
        )}

        {/* Descarga */}
        {stage === 'done' && downloadUrl && (
          <div style={{
            marginTop: '1.5rem',
            background: 'rgba(34,197,94,0.06)',
            border: '1px solid rgba(34,197,94,0.25)',
            borderRadius: 14,
            padding: '1.5rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
            <p style={{ fontWeight: 700, marginBottom: '1rem' }}>¡Video listo!</p>
            <a
              href={downloadUrl}
              download={`Muestra para ${text.trim() || 'video'}.mp4`}
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #f97316, #ef4444)',
                color: '#fff',
                padding: '0.75rem 2rem',
                borderRadius: 10,
                fontWeight: 700,
                textDecoration: 'none',
                fontSize: '0.95rem',
              }}
            >
              Descargar MP4
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
        {icon} {label}
      </p>
      {children}
    </div>
  );
}

function UploadButton({
  label, accept, inputRef, onChange, active,
}: {
  label: string;
  accept: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  active: boolean;
}) {
  return (
    <>
      <input type="file" accept={accept} ref={inputRef} onChange={onChange} style={{ display: 'none' }} />
      <button
        onClick={() => inputRef.current?.click()}
        style={{
          width: '100%',
          padding: '0.75rem 1rem',
          borderRadius: 10,
          border: `1px solid ${active ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.12)'}`,
          background: active ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.04)',
          color: active ? '#f97316' : 'rgba(255,255,255,0.5)',
          textAlign: 'left',
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: active ? 600 : 400,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {active ? '✓ ' : '+ '}{label}
      </button>
    </>
  );
}
