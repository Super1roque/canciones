'use client';
import { useState } from 'react';

function construirPromptEstilo(url: string): string {
  return `Actúa como un compositor experto en producción musical y métrica.

Analiza la canción de este video: ${url}

Dame un "Style Prompt" técnico y detallado para Suno AI (máximo 1000 caracteres), cubriendo:
- Instrumentación: todos los instrumentos que definen el sonido.
- Vibe y voz: emoción dominante, carácter, tono/velocidad/actitud vocal.
- Estilo: género exacto, tempo (BPM) y compás (ej. 3/4 o 4/4).
- Estructura: mapa de secciones con etiquetas de Suno entre corchetes (ej. [Intro], [Verse], [Chorus], [Bridge], [Outro]).

Respondé ÚNICAMENTE con el prompt final, listo para pegar en el campo de Estilo de Suno.ai — sin explicaciones antes o después.`;
}

function construirPromptIntro(url: string): string {
  return `Actúa como un compositor experto en métrica y producción musical.

Analiza la canción de este video: ${url}

Enfocate ÚNICAMENTE en el INTRO de la canción. Dame un detalle técnico y bien analizado (máximo 1000 caracteres) con instrucciones claras para Suno AI sobre esa sección: instrumentación, dinámica, duración aproximada y sugerencias de etiquetas de estructura entre corchetes (ej. [Intro], [Instrumental]).

Respondé ÚNICAMENTE con el detalle del intro, listo para pegar en las instrucciones de Suno.ai — sin explicaciones antes o después.`;
}

function esUrlYoutube(url: string): boolean {
  return /youtu\.?be/.test(url);
}

function urlBusquedaLyricFind(nombre: string): string {
  // Google site-search en vez de adivinar el endpoint interno de LyricFind —
  // solo arma un link, no trae ni muestra ninguna letra acá.
  return `https://www.google.com/search?q=${encodeURIComponent(`site:lyrics.lyricfind.com ${nombre}`)}`;
}

// Limpia sufijos típicos de títulos de YouTube ("(Official Video)", "[Lyrics]",
// "(4K Remaster)", etc.) y agrega el nombre del canal/artista si no aparece ya.
function limpiarTitulo(titulo: string, autor: string): string {
  const SUFIJOS = /[([][^)\]]*\b(official|video|audio|lyrics?|remaster|visualizer|hd|4k|mv|clip)\b[^)\]]*[)\]]/gi;
  const limpio = titulo.replace(SUFIJOS, '').replace(/\s{2,}/g, ' ').trim();
  const yaTieneAutor = autor && limpio.toLowerCase().includes(autor.toLowerCase());
  return yaTieneAutor || !autor ? limpio : `${limpio} - ${autor}`;
}

export default function PromptSunoPage() {
  const [url, setUrl] = useState('');
  const [nombreCancion, setNombreCancion] = useState('');
  const [buscandoTitulo, setBuscandoTitulo] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [copiado, setCopiado] = useState<'estilo' | 'intro' | null>(null);

  const urlLimpia = url.trim();
  const promptEstilo = construirPromptEstilo(urlLimpia);
  const promptIntro = construirPromptIntro(urlLimpia);

  async function copiar(texto: string, cual: 'estilo' | 'intro') {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(cual);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      alert('No se pudo copiar. Copialo manualmente.');
    }
  }

  async function abrirModal() {
    setMostrarModal(true);
    setBuscandoTitulo(true);
    try {
      const res = await fetch(`/api/youtube-titulo?url=${encodeURIComponent(urlLimpia)}`);
      const data = await res.json();
      if (res.ok) setNombreCancion(limpiarTitulo(data.titulo, data.autor));
    } catch {
      // si falla, el campo queda vacío y se llena a mano — no es crítico
    } finally {
      setBuscandoTitulo(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <header className="header">
        <div className="header-inner">
          <div className="logo"><span className="logo-icon">🎵</span><span className="logo-text">Canciones</span></div>
          <a href="/admin" className="nav-btn">← Volver</a>
        </div>
      </header>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.3rem' }}>🎛️ Prompts para Suno</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.75rem' }}>
          Pegá la URL de un video de YouTube y armo los prompts de <strong>Estilo</strong> e <strong>Intro</strong> listos para pegar en Gemini o Grok (esas IAs sí pueden escuchar el video) — separados y listos para usar después en Suno.ai
        </p>

        <div className="form-group">
          <label htmlFor="yt-url">URL del video</label>
          <input
            id="yt-url"
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://youtu.be/..."
            style={{
              width: '100%', padding: '0.75rem', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
              fontFamily: 'inherit', fontSize: '0.92rem',
            }}
          />
          {url && !esUrlYoutube(url) && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              ⚠️ No parece un link de YouTube — igual se genera el prompt, revisalo antes de usarlo.
            </p>
          )}
        </div>

        <button className="kk-btn primary" onClick={abrirModal} disabled={!urlLimpia}
          style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginTop: '0.75rem',
            opacity: !urlLimpia ? 0.5 : 1 }}>
          🎛️ Generar prompts
        </button>

        <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.65rem 1rem',
          background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', lineHeight: 1.8 }}>
          💡 Esta página solo arma el texto del prompt — no analiza el video ni extrae la letra. Los prompts te los llevás a Gemini/Grok vos mismo.
        </div>
      </div>

      {mostrarModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }} onClick={() => setMostrarModal(false)}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '1.5rem',
            maxWidth: 560, width: '100%', maxHeight: '85vh',
            display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>🎛️ Prompts generados</h3>
              <button onClick={() => setMostrarModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            {[
              { clave: 'estilo' as const, titulo: '🎼 Estilo', texto: promptEstilo },
              { clave: 'intro' as const, titulo: '🎬 Intro', texto: promptIntro },
            ].map(({ clave, titulo, texto }) => (
              <div key={clave}>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>{titulo}</p>
                <div style={{
                  background: 'var(--surface2)', borderRadius: 'var(--radius-sm)',
                  padding: '0.85rem', fontFamily: 'Fira Mono, monospace', fontSize: '0.8rem',
                  lineHeight: 1.6, border: '1px solid var(--border)', whiteSpace: 'pre-wrap',
                  maxHeight: 220, overflowY: 'auto', marginBottom: '0.5rem',
                }}>
                  {texto}
                </div>
                <button className="kk-btn primary" onClick={() => copiar(texto, clave)}
                  style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}>
                  {copiado === clave ? '✓ Copiado' : '📋 Copiar'}
                </button>
              </div>
            ))}

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.1rem' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>🔎 Buscar letra por nombre</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Abre la búsqueda en LyricFind en una pestaña nueva — no trae la letra a la app, la buscás y copiás vos.
                {buscandoTitulo && ' Buscando el título del video…'}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={nombreCancion}
                  onChange={e => setNombreCancion(e.target.value)}
                  placeholder="Nombre de la canción y artista"
                  style={{
                    flex: 1, padding: '0.6rem 0.75rem', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)',
                    fontFamily: 'inherit', fontSize: '0.85rem',
                  }}
                />
                <a
                  href={nombreCancion.trim() ? urlBusquedaLyricFind(nombreCancion.trim()) : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="kk-btn primary"
                  style={{
                    padding: '0.55rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center',
                    textDecoration: 'none', opacity: nombreCancion.trim() ? 1 : 0.5,
                    pointerEvents: nombreCancion.trim() ? 'auto' : 'none',
                  }}
                >
                  Buscar
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
