'use client';
import { useState } from 'react';

const NOTES = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);

function transformChord(token: string): string {
  if (!token) return token;

  // Root note must start with A-G
  if (!NOTES.has(token[0].toUpperCase())) return token;

  let i = 1;
  // Optional accidental: # b ♯ ♭
  if (i < token.length && '#b♯♭'.includes(token[i])) i++;

  const rest = token.slice(i);

  if (rest === '')             return token + 'maj7';   // C  → Cmaj7
  if (rest === 'm' || rest === 'min') return token.slice(0, i) + 'm7'; // Am → Am7
  return token;                                          // anything else: leave
}

function transformText(text: string): string {
  // Match potential chord tokens (letter + optional extras)
  return text.replace(/[A-G][#b♯♭]?[A-Za-z0-9]*/g, transformChord);
}

export default function AcordesPage() {
  const [input,  setInput]  = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  function convert() {
    setOutput(transformText(input));
    setCopied(false);
  }

  function copy() {
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const examples = [
    { label: 'Pop', in: 'C - G - Am - F' },
    { label: 'Jazz', in: 'Dm - G7 - Cmaj7 - Am' },
    { label: 'Balada', in: 'D - A - Bm - G' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <header className="header">
        <div className="header-inner">
          <div className="logo"><span className="logo-icon">🎵</span><span className="logo-text">Canciones</span></div>
          <a href="/" className="nav-btn">← Volver</a>
        </div>
      </header>

      <div style={{ maxWidth: 580, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.3rem' }}>🎸 Convertidor de Acordes</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.75rem' }}>
          Convierte acordes mayores a <strong>maj7</strong> y menores a <strong>m7</strong> — acordes con extensión ya definida se conservan
        </p>

        {/* Ejemplos rápidos */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {examples.map(ex => (
            <button key={ex.label} onClick={() => { setInput(ex.in); setOutput(''); }}
              style={{ padding: '0.3rem 0.75rem', borderRadius: 8, fontSize: '0.78rem', cursor: 'pointer',
                border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }}>
              {ex.label}: {ex.in}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
            Progresión original
          </label>
          <textarea
            value={input}
            onChange={e => { setInput(e.target.value); setOutput(''); }}
            placeholder={'C - G - Am - F\nDm - G - C - Am\nPuedes pegar varias líneas'}
            rows={5}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '0.75rem', color: 'var(--text)',
              fontSize: '1rem', fontFamily: 'monospace', resize: 'vertical',
            }}
          />
        </div>

        <button
          className="kk-btn primary"
          onClick={convert}
          disabled={!input.trim()}
          style={{ width: '100%', padding: '0.8rem', fontSize: '1rem', marginBottom: '1.25rem',
            opacity: !input.trim() ? 0.5 : 1 }}
        >
          🎵 Convertir a maj7 / m7
        </button>

        {/* Output */}
        {output && (
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '1.25rem', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Resultado</span>
              <button className="kk-btn primary" onClick={copy} style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>
                {copied ? '✅ Copiado' : '📋 Copiar'}
              </button>
            </div>
            <pre style={{
              margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontFamily: 'monospace', fontSize: '1rem', color: '#f97316', lineHeight: 1.7,
            }}>
              {output}
            </pre>

            {/* Diff visual */}
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Comparación:</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                <div style={{ color: 'var(--text-muted)' }}>
                  {input.split('\n').map((l, i) => <div key={i}>{l || <br />}</div>)}
                </div>
                <div style={{ color: '#f97316' }}>
                  {output.split('\n').map((l, i) => <div key={i}>{l || <br />}</div>)}
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.65rem 1rem',
          background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', lineHeight: 1.8 }}>
          💡 <strong>C → Cmaj7</strong> · <strong>Am → Am7</strong> · <strong>C7</strong> se conserva · <strong>Cmaj7</strong> se conserva · <strong>Cdim</strong> se conserva
        </div>
      </div>
    </div>
  );
}
