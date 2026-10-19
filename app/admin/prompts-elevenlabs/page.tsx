'use client';
import { useState } from 'react';

const TONOS_SUGERIDOS = [
  'serio y narrativo',
  'sarcástico y crítico',
  'alegre y enérgico',
  'neutral e informativo',
  'íntimo y emotivo',
  'tenso y dramático',
];

export default function PromptsElevenLabsPage() {
  const [texto, setTexto] = useState('');
  const [tono, setTono] = useState(TONOS_SUGERIDOS[0]);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState('');
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);

  async function generar() {
    if (!texto.trim()) return;
    setCargando(true);
    setError('');
    setResultado('');
    setCopiado(false);
    try {
      const res = await fetch('/api/prompts-elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, tono }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error generando el prompt');
      setResultado(data.resultado);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(resultado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // el navegador bloqueó el portapapeles — no es crítico, el usuario puede seleccionar y copiar a mano
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <header className="header">
        <div className="header-inner">
          <div className="logo"><span className="logo-icon">🎙️</span><span className="logo-text">Canciones</span></div>
          <a href="/admin" className="nav-btn">← Volver</a>
        </div>
      </header>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.3rem' }}>🎙️ Prompts para ElevenLabs</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.75rem', lineHeight: 1.6 }}>
          Pegá un texto plano en español y lo devuelvo con los <strong>audio tags de Eleven v3</strong> (pausas, tono,
          énfasis) ya insertados en los lugares correctos — listo para pegar directo en ElevenLabs.
        </p>

        <div className="form-group">
          <label htmlFor="texto">Texto a convertir</label>
          <textarea
            id="texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Pegá aquí el guion en español, sin formato ni etiquetas..."
            rows={10}
            style={{
              width: '100%', padding: '0.75rem', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
              fontFamily: 'inherit', fontSize: '0.9rem', lineHeight: 1.5, resize: 'vertical',
            }}
          />
        </div>

        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label htmlFor="tono">Tono deseado</label>
          <input
            id="tono"
            type="text"
            list="tonos-sugeridos"
            value={tono}
            onChange={(e) => setTono(e.target.value)}
            placeholder="ej. serio y narrativo"
            style={{
              width: '100%', padding: '0.75rem', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
              fontFamily: 'inherit', fontSize: '0.92rem',
            }}
          />
          <datalist id="tonos-sugeridos">
            {TONOS_SUGERIDOS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
            Elegí uno de la lista o escribí el tuyo (ej. &quot;sarcástico pero contenido&quot;).
          </p>
        </div>

        <button
          className="kk-btn primary"
          onClick={generar}
          disabled={!texto.trim() || cargando}
          style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginTop: '1.25rem', opacity: !texto.trim() || cargando ? 0.5 : 1 }}
        >
          {cargando ? '⏳ Generando...' : '🎙️ Generar prompt'}
        </button>

        {error && (
          <div style={{
            marginTop: '1rem', fontSize: '0.85rem', color: 'var(--error)', padding: '0.75rem 1rem',
            background: 'rgba(224,93,93,0.1)', borderRadius: 8, border: '1px solid rgba(224,93,93,0.35)',
          }}>
            ⚠️ {error}
          </div>
        )}

        {resultado && (
          <div style={{ marginTop: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>✅ Listo para ElevenLabs</p>
              <button
                onClick={copiar}
                style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)',
                  borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.8rem', fontSize: '0.78rem', cursor: 'pointer',
                }}
              >
                {copiado ? '✓ Copiado' : '📋 Copiar'}
              </button>
            </div>
            <div
              style={{
                background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '1rem',
                fontFamily: 'Fira Mono, monospace', fontSize: '0.82rem', lineHeight: 1.65,
                border: '1px solid var(--border)', whiteSpace: 'pre-wrap', maxHeight: 420, overflowY: 'auto',
              }}
            >
              {resultado}
            </div>
          </div>
        )}

        <div style={{
          marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.65rem 1rem',
          background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', lineHeight: 1.8,
        }}>
          💡 Pensado para <strong>Eleven v3</strong>, que usa audio tags entre corchetes en vez de SSML. No manda
          nada a ElevenLabs — solo arma el texto, vos lo pegás después en su consola.
        </div>
      </div>
    </div>
  );
}
