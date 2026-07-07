'use client';
import { useState } from 'react';

const ESTILOS = [
  { value: '',            label: '🎲 Sorpréndeme (sin estilo fijo)' },
  { value: 'tradicional', label: '🤠 Corrido Tradicional Norteño' },
  { value: 'tumbado',     label: '🥃 Corrido Tumbado' },
  { value: 'alterado',    label: '💀 Corrido Alterado' },
  { value: 'sierra',      label: '🏔️ Corrido de la Sierra' },
];

export default function CorridoPage() {
  const [nombre,  setNombre]  = useState('');
  const [region,  setRegion]  = useState('');
  const [estilo,  setEstilo]  = useState('');
  const [corrido, setCorrido] = useState('');
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCorrido('');
    setGenerando(true);
    try {
      const res  = await fetch('/api/corrido/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, region, estilo }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al generar'); return; }
      setCorrido(data.corrido);
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setGenerando(false);
    }
  }

  function copiar() {
    navigator.clipboard.writeText(corrido)
      .then(() => alert('¡Corrido copiado al portapapeles!'))
      .catch(() => alert('No se pudo copiar'));
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.25rem' }}>🎸 Generador de Corridos</h1>
      <p style={{ color: '#888', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Ingresa los datos del protagonista y generamos su corrido personalizado.
      </p>

      <form onSubmit={handleGenerar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem', fontSize: '0.9rem' }}>
            Estilo de corrido <span style={{ color: '#888', fontWeight: 400 }}>(opcional)</span>
          </label>
          <select
            value={estilo}
            onChange={e => setEstilo(e.target.value)}
            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: '0.95rem' }}
          >
            {ESTILOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem', fontSize: '0.9rem' }}>
            Nombre del protagonista <span style={{ color: '#e55' }}>*</span>
          </label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Ej: El Charro Negro, Juan Medina..."
            required
            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: '0.95rem', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem', fontSize: '0.9rem' }}>
            Estado o región <span style={{ color: '#e55' }}>*</span>
          </label>
          <input
            type="text"
            value={region}
            onChange={e => setRegion(e.target.value)}
            placeholder="Ej: Sinaloa, Sonora, Tierra Caliente..."
            required
            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: '0.95rem', boxSizing: 'border-box' }}
          />
        </div>

        <button
          type="submit"
          disabled={generando}
          style={{ padding: '0.7rem 1.5rem', borderRadius: 8, background: generando ? '#444' : '#8b5cf6', color: '#fff', fontWeight: 700, border: 'none', cursor: generando ? 'not-allowed' : 'pointer', fontSize: '1rem' }}
        >
          {generando ? '🎵 Componiendo...' : '🎸 Generar Corrido'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: '1.5rem', padding: '0.75rem 1rem', background: '#3b1010', border: '1px solid #7f1d1d', borderRadius: 8, color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {corrido && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>🎤 Tu corrido</h2>
            <button onClick={copiar} style={{ padding: '0.4rem 0.9rem', borderRadius: 6, background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', cursor: 'pointer', fontSize: '0.85rem' }}>
              📋 Copiar
            </button>
          </div>
          <pre style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '1.25rem', whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '0.95rem', color: '#e2e8f0' }}>
            {corrido}
          </pre>
        </div>
      )}
    </div>
  );
}
