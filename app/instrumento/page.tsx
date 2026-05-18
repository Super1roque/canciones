'use client';
import { useState, useRef } from 'react';

type NoteEvent = {
  startTimeSeconds: number;
  durationSeconds:  number;
  pitchMidi:        number;
  amplitude:        number;
};

type Phase = 'idle' | 'loading_model' | 'analyzing' | 'ready' | 'playing' | 'error';

const INSTRUMENTS = [
  { id: 'acoustic_grand_piano', label: '🎹 Piano' },
  { id: 'violin',               label: '🎻 Violín' },
  { id: 'acoustic_guitar_nylon', label: '🎸 Guitarra' },
  { id: 'flute',                label: '🪈 Flauta' },
  { id: 'trumpet',              label: '🎺 Trompeta' },
] as const;

type InstrumentId = typeof INSTRUMENTS[number]['id'];

function fmtSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function InstrumentoPage() {
  const [file,       setFile]       = useState<File | null>(null);
  const [phase,      setPhase]      = useState<Phase>('idle');
  const [progress,   setProgress]   = useState(0);
  const [notes,      setNotes]      = useState<NoteEvent[]>([]);
  const [error,      setError]      = useState('');
  const [dragging,   setDragging]   = useState(false);
  const [instrument, setInstrument] = useState<InstrumentId>('acoustic_grand_piano');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef   = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  function handleFile(f: File) {
    if (!f.type.startsWith('audio/')) { setError('Solo archivos de audio'); return; }
    if (f.size > 10 * 1024 * 1024)   { setError('El archivo supera 10 MB'); return; }
    setError(''); setFile(f); setNotes([]); setPhase('idle');
  }

  async function analyze() {
    if (!file) return;
    setPhase('loading_model');
    setProgress(0);
    setError('');

    try {
      const {
        BasicPitch,
        noteFramesToTime,
        addPitchBendsToNoteEvents,
        outputToNotesPoly,
        // eslint-disable-next-line @typescript-eslint/no-require-imports
      } = await import('@spotify/basic-pitch');

      setPhase('analyzing');

      // Decode to mono Float32Array at 22050 Hz (required by Basic Pitch)
      const decodeCtx = new AudioContext({ sampleRate: 22050 });
      const arrayBuf  = await file.arrayBuffer();
      const audioBuf  = await decodeCtx.decodeAudioData(arrayBuf);
      await decodeCtx.close();

      let mono: Float32Array;
      if (audioBuf.numberOfChannels === 1) {
        mono = audioBuf.getChannelData(0);
      } else {
        const ch0 = audioBuf.getChannelData(0);
        const ch1 = audioBuf.getChannelData(1);
        mono = new Float32Array(ch0.length);
        for (let i = 0; i < ch0.length; i++) mono[i] = (ch0[i] + ch1[i]) / 2;
      }

      const allFrames:   number[][] = [];
      const allOnsets:   number[][] = [];
      const allContours: number[][] = [];

      const bp = new BasicPitch(
        '/basic-pitch-model/model.json',
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await bp.evaluateModel(
        mono,
        (frames: number[][], onsets: number[][], contours: number[][]) => {
          allFrames.push(...frames);
          allOnsets.push(...onsets);
          allContours.push(...contours);
        },
        (p: number) => setProgress(Math.round(p * 100)),
      );

      const detected: NoteEvent[] = noteFramesToTime(
        addPitchBendsToNoteEvents(
          allContours,
          outputToNotesPoly(allFrames, allOnsets, 0.25, 0.25, 5, true, null, null, false, 11),
        ),
      ) as NoteEvent[];

      setNotes(detected);
      setPhase('ready');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Error al analizar');
      setPhase('error');
    }
  }

  async function play() {
    if (!notes.length) return;
    stopPlayback();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Soundfont: any = (await import('soundfont-player')).default;

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      setPhase('playing');

      const sfPlayer = await Soundfont.instrument(ctx, instrument, {
        soundfont: 'MusyngKite',
      });
      playerRef.current = sfPlayer;

      const now = ctx.currentTime + 0.1;
      notes.forEach(note => {
        sfPlayer.play(String(note.pitchMidi), now + note.startTimeSeconds, {
          duration: note.durationSeconds,
          gain: Math.min(1, note.amplitude * 1.5),
        });
      });

      const totalDur = Math.max(...notes.map(n => n.startTimeSeconds + n.durationSeconds));
      setTimeout(() => setPhase('ready'), (totalDur + 1) * 1000);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Error al reproducir');
      setPhase('ready');
    }
  }

  function stopPlayback() {
    if (playerRef.current) { playerRef.current.stop(); playerRef.current = null; }
    if (phase === 'playing') setPhase('ready');
  }

  const busy = phase === 'loading_model' || phase === 'analyzing';

  const statusMsg =
    phase === 'loading_model' ? 'Cargando modelo IA (primera vez puede tardar ~20 seg)...' :
    phase === 'analyzing'     ? `Analizando melodía... ${progress}%` :
    phase === 'ready'         ? `✓ ${notes.length} notas detectadas` :
    phase === 'playing'       ? '▶ Reproduciendo...' : '';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <header className="header">
        <div className="header-inner">
          <div className="logo"><span className="logo-icon">🎵</span><span className="logo-text">Canciones</span></div>
          <a href="/" className="nav-btn">← Volver</a>
        </div>
      </header>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.3rem' }}>🎹 Voz a Instrumento</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.75rem' }}>
          Detecta la melodía de un audio a capella y la reproduce con un instrumento real
        </p>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault(); setDragging(false);
            const f = e.dataTransfer.files[0]; if (f) handleFile(f);
          }}
          onClick={() => document.getElementById('inst-file')?.click()}
          style={{
            border: `2px dashed ${dragging ? '#f97316' : file ? 'var(--success)' : 'var(--border)'}`,
            borderRadius: 14, padding: '2.5rem 2rem', textAlign: 'center', cursor: 'pointer',
            background: dragging ? 'rgba(249,115,22,0.06)' : file ? 'rgba(78,201,160,0.04)' : 'var(--surface)',
            transition: 'all 0.2s', marginBottom: '1.5rem',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{file ? '🎵' : '📁'}</div>
          {file ? (
            <>
              <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.2rem' }}>{file.name}</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{fmtSize(file.size)}</p>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.3rem' }}>
                Arrastra un audio a capella o haz clic
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>MP3 · WAV · M4A — máximo 10 MB</p>
            </>
          )}
          <input id="inst-file" type="file" accept="audio/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
        </div>

        {/* Instrument selector */}
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Instrumento de salida
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {INSTRUMENTS.map(inst => (
              <button key={inst.id} onClick={() => setInstrument(inst.id)}
                style={{
                  padding: '0.4rem 0.85rem', borderRadius: 8, fontSize: '0.82rem', cursor: 'pointer',
                  border: instrument === inst.id ? '1px solid #f97316' : '1px solid var(--border)',
                  background: instrument === inst.id ? 'rgba(249,115,22,0.15)' : 'var(--surface)',
                  color: instrument === inst.id ? '#f97316' : 'var(--text-muted)',
                }}>
                {inst.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>⚠️ {error}</p>
        )}

        {/* Status + progress */}
        {statusMsg && (
          <p style={{
            fontSize: '0.85rem', marginBottom: '0.75rem',
            color: phase === 'ready' ? 'var(--success)' : 'var(--text-muted)',
          }}>
            {statusMsg}
          </p>
        )}
        {phase === 'analyzing' && (
          <div style={{ background: 'var(--border)', borderRadius: 4, height: 6, marginBottom: '1rem', overflow: 'hidden' }}>
            <div style={{ background: '#f97316', height: '100%', width: `${progress}%`, transition: 'width 0.3s', borderRadius: 4 }} />
          </div>
        )}

        {/* Analyze button */}
        {phase !== 'ready' && phase !== 'playing' && (
          <button
            className="kk-btn primary"
            onClick={analyze}
            disabled={!file || busy}
            style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginBottom: '0.75rem',
              opacity: (!file || busy) ? 0.5 : 1 }}
          >
            {busy ? '⏳ Procesando...' : '🎵 Analizar melodía'}
          </button>
        )}

        {/* Play / Stop */}
        {(phase === 'ready' || phase === 'playing') && (
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <button
              className="kk-btn primary"
              onClick={play}
              disabled={phase === 'playing'}
              style={{ flex: 1, padding: '0.85rem', fontSize: '1rem', opacity: phase === 'playing' ? 0.5 : 1 }}
            >
              ▶ Reproducir con {INSTRUMENTS.find(i => i.id === instrument)?.label.split(' ')[1]}
            </button>
            {phase === 'playing' && (
              <button onClick={stopPlayback}
                style={{ padding: '0.85rem 1.25rem', fontSize: '1rem', cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text)', borderRadius: 10 }}>
                ⏹ Parar
              </button>
            )}
          </div>
        )}

        {phase === 'ready' && (
          <button
            onClick={() => { setPhase('idle'); setNotes([]); setFile(null); }}
            style={{ width: '100%', padding: '0.5rem', fontSize: '0.82rem', cursor: 'pointer',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-muted)', borderRadius: 8 }}
          >
            Cargar otro archivo
          </button>
        )}

        <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.65rem 1rem',
          background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', lineHeight: 1.8 }}>
          💡 Funciona mejor con <strong>voz sola</strong> sin música de fondo · Todo el análisis ocurre en tu dispositivo, sin subir el archivo a ningún servidor
        </div>
      </div>
    </div>
  );
}
