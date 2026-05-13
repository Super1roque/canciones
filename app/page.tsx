'use client';
import { useState, useEffect, useCallback } from 'react';

// ── Tipos ──────────────────────────────────────────────────────────────
type Cancion = { id: string; nombre: string; estilo: string; descripcionEstilo?: string; direccionGenerador?: string; letra: string };
type ParodiaResult = { cancion_base: string; estilo: string; descripcionEstilo: string; direccionGenerador: string; historia: string; parodia: string; modoPrueba?: boolean };
type Creacion = { id: string; cancion_base: string; estilo?: string; descripcionEstilo?: string; direccionGenerador?: string; urlCancion?: string; historia: string; parodia: string; fecha: string };
type Tab = 'crear' | 'coleccion' | 'creaciones';
type Toast = { msg: string; type: 'success' | 'error' | '' } | null;

// ── Utilidades ─────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Componente Toast ───────────────────────────────────────────────────
function ToastNotification({ toast }: { toast: Toast }) {
  if (!toast) return null;
  return <div className={`toast ${toast.type}`}>{toast.msg}</div>;
}

// ── Player embebido ────────────────────────────────────────────────────
function getEmbedUrl(url: string): { type: 'youtube' | 'spotify' | 'audio' | 'iframe'; src: string } {
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const id = u.hostname.includes('youtu.be')
        ? u.pathname.slice(1)
        : u.searchParams.get('v') ?? '';
      return { type: 'youtube', src: `https://www.youtube.com/embed/${id}?autoplay=1` };
    }
    // Spotify
    if (u.hostname.includes('spotify.com')) {
      const src = url.replace('open.spotify.com/', 'open.spotify.com/embed/');
      return { type: 'spotify', src };
    }
    // Audio directo
    if (/\.(mp3|ogg|wav|m4a|aac|flac)(\?.*)?$/i.test(u.pathname)) {
      return { type: 'audio', src: url };
    }
    return { type: 'iframe', src: url };
  } catch {
    return { type: 'audio', src: url };
  }
}

function PlayerEmbed({ url, onClose }: { url: string; onClose: () => void }) {
  const embed = getEmbedUrl(url);
  return (
    <div className="player-container">
      <button className="player-close" onClick={onClose}>✕ Cerrar player</button>
      {embed.type === 'audio' ? (
        <audio controls autoPlay src={embed.src} style={{ width: '100%' }} />
      ) : (
        <iframe
          src={embed.src}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          style={{
            width: '100%',
            height: embed.type === 'spotify' ? '80px' : '200px',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
          }}
        />
      )}
    </div>
  );
}

// ── Componente Modal ───────────────────────────────────────────────────
function Modal({ onClose, large, children }: { onClose: () => void; large?: boolean; children: React.ReactNode }) {
  return (
    <div className="modal">
      <div className="modal-overlay" onClick={onClose} />
      <div className={`modal-box ${large ? 'modal-box-lg' : ''}`}>{children}</div>
    </div>
  );
}

// ── Modal: Crear / Editar Canción ──────────────────────────────────────
function ModalCancion({
  cancion,
  onClose,
  onGuardada,
  showToast,
}: {
  cancion?: Cancion;
  onClose: () => void;
  onGuardada: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | '') => void;
}) {
  const isEdit = !!cancion;
  const [nombre, setNombre] = useState(cancion?.nombre ?? '');
  const [estilo, setEstilo] = useState(cancion?.estilo ?? '');
  const [descripcionEstilo, setDescripcionEstilo] = useState(cancion?.descripcionEstilo ?? '');
  const [direccionGenerador, setDireccionGenerador] = useState(cancion?.direccionGenerador ?? '');
  const [letra, setLetra] = useState(cancion?.letra ?? '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = isEdit ? `/api/canciones/${cancion!.id}` : '/api/canciones';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, estilo, descripcionEstilo, direccionGenerador, letra }),
      });
      if (!res.ok) { const d = await res.json(); showToast(d.error || 'Error al guardar', 'error'); return; }
      showToast(isEdit ? `"${nombre}" actualizada` : `"${nombre}" agregada a la colección`, 'success');
      onGuardada();
      onClose();
    } catch {
      showToast('Error de conexión', 'error');
    }
  }

  return (
    <Modal onClose={onClose} large>
      <div className="modal-header">
        <h3>{isEdit ? 'Editar canción' : 'Agregar nueva canción'}</h3>
        <button className="btn-close" onClick={onClose}>✕</button>
      </div>
      <form className="form-agregar" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="c-nombre">Nombre de la canción *</label>
            <input
              id="c-nombre"
              type="text"
              placeholder="Ej: La Bamba"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="c-estilo">Estilo musical *</label>
            <input
              id="c-estilo"
              type="text"
              placeholder="Ej: Balada, Pop, Rock..."
              value={estilo}
              onChange={e => setEstilo(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="c-desc-estilo">Descripción del estilo</label>
          <textarea
            id="c-desc-estilo"
            rows={3}
            placeholder="Ej: Tempo lento, melodía melancólica, instrumentación con piano y cuerdas, tono emotivo..."
            value={descripcionEstilo}
            onChange={e => setDescripcionEstilo(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="c-dir-gen">Dirección en Generador</label>
          <textarea
            id="c-dir-gen"
            rows={3}
            placeholder="Ej: Mantener el tono melancólico, enfatizar la nostalgia, evitar humor sarcástico..."
            value={direccionGenerador}
            onChange={e => setDireccionGenerador(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="c-letra">Letra completa *</label>
          <textarea
            id="c-letra"
            rows={14}
            placeholder="Pega aquí la letra completa. Usa [VERSO 1], [CORO], [PUENTE], etc."
            value={letra}
            onChange={e => setLetra(e.target.value)}
            required
          />
        </div>
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary">{isEdit ? 'Guardar cambios' : 'Agregar Canción'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Tab: Crear Parodia ─────────────────────────────────────────────────
function TabCrear({
  canciones,
  showToast,
  onVerLetra,
  onAbrirAgregar,
  onEditar,
  onEliminada,
}: {
  canciones: Cancion[];
  showToast: (msg: string, type?: 'success' | 'error' | '') => void;
  onVerLetra: (cancion: Cancion) => void;
  onAbrirAgregar: () => void;
  onEditar: (cancion: Cancion) => void;
  onEliminada: () => void;
}) {
  const [seleccionada, setSeleccionada] = useState<Cancion | null>(null);
  const [historia, setHistoria] = useState('');
  const [generando, setGenerando] = useState(false);
  const [parodiaActual, setParodiaActual] = useState<ParodiaResult | null>(null);
  const [guardada, setGuardada] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const cancionesFiltradas = canciones.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.estilo.toLowerCase().includes(busqueda.toLowerCase())
  );

  function seleccionarCancion(c: Cancion) {
    setSeleccionada(c);
    setParodiaActual(null);
    setGuardada(false);
  }

  async function eliminarCancion(e: React.MouseEvent, c: Cancion) {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${c.nombre}" de la colección?`)) return;
    try {
      const res = await fetch(`/api/canciones/${c.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast(`"${c.nombre}" eliminada`, 'success');
      if (seleccionada?.id === c.id) setSeleccionada(null);
      onEliminada();
    } catch {
      showToast('Error al eliminar la canción', 'error');
    }
  }

  async function handleGenerar() {
    if (!seleccionada) { showToast('Primero selecciona una canción', 'error'); return; }
    if (historia.trim().length < 10) { showToast('Escribe una historia más detallada (mínimo 10 caracteres)', 'error'); return; }

    setGenerando(true);
    setParodiaActual(null);
    try {
      const res = await fetch('/api/parodias/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancionId: seleccionada.id, historia }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Error al generar la parodia', 'error'); return; }
      setParodiaActual(data);
      setGuardada(false);
    } catch {
      showToast('Error de conexión con el servidor', 'error');
    } finally {
      setGenerando(false);
    }
  }

  async function handleGuardar() {
    if (!parodiaActual) return;
    try {
      const res = await fetch('/api/parodias/guardar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parodiaActual),
      });
      if (!res.ok) { const d = await res.json(); showToast(d.error || 'Error al guardar', 'error'); return; }
      showToast('¡Parodia guardada en "Mis Creaciones"!', 'success');
      setGuardada(true);
    } catch {
      showToast('Error de conexión', 'error');
    }
  }

  function handleCopiar() {
    if (!parodiaActual) return;
    navigator.clipboard.writeText(parodiaActual.parodia)
      .then(() => showToast('Parodia copiada al portapapeles', 'success'))
      .catch(() => showToast('No se pudo copiar', 'error'));
  }

  return (
    <div className="two-col">
      {/* Lista de canciones */}
      <aside className="panel panel-songs">
        <div className="panel-header">
          <h2>Canciones disponibles</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="count-badge">{cancionesFiltradas.length}</span>
            <button className="btn-icon" onClick={onAbrirAgregar}>+ Nueva</button>
          </div>
        </div>
        <div style={{ padding: '0 0.75rem 0.5rem' }}>
          <input
            type="search"
            placeholder="Buscar canción o estilo…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '0.4rem 0.65rem', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'var(--surface-2)',
              color: 'var(--text)', fontSize: '0.85rem',
            }}
          />
        </div>
        <div className="song-list">
          {canciones.length === 0 ? (
            <div className="loading-msg">No hay canciones en la colección</div>
          ) : cancionesFiltradas.length === 0 ? (
            <div className="loading-msg">Sin resultados para &quot;{busqueda}&quot;</div>
          ) : (
            cancionesFiltradas.map(c => (
              <div
                key={c.id}
                className={`song-item ${seleccionada?.id === c.id ? 'selected' : ''}`}
                onClick={() => seleccionarCancion(c)}
              >
                <div className="song-item-info">
                  <span className="song-item-name">{c.nombre}</span>
                  <span className="song-item-style">{c.estilo}</span>
                </div>
                <div className="song-item-actions">
                  <button className="btn-icon-xs" title="Editar" onClick={e => { e.stopPropagation(); onEditar(c); }}>✏️</button>
                  <button className="btn-icon-xs danger" title="Eliminar" onClick={e => eliminarCancion(e, c)}>🗑</button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Panel principal */}
      <section className="panel panel-main">
        {seleccionada ? (
          <>
            <div className="song-detail">
              <div className="song-detail-header">
                <div>
                  <h3>{seleccionada.nombre}</h3>
                  <span className="badge">{seleccionada.estilo}</span>
                  {seleccionada.descripcionEstilo && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                      {seleccionada.descripcionEstilo}
                    </p>
                  )}
                  {seleccionada.direccionGenerador && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--accent-soft)', marginTop: '0.25rem' }}>
                      🧭 {seleccionada.direccionGenerador}
                    </p>
                  )}
                </div>
                <button className="btn-icon" onClick={() => onVerLetra(seleccionada)}>
                  📄 Ver letra
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="historia">Historia o temática para la parodia</label>
              <textarea
                id="historia"
                rows={5}
                placeholder="Ej: Un estudiante que odia los lunes, llega tarde a clases, se olvidó la tarea y su maestro es muy estricto...&#10;&#10;💡 Modo prueba: comienza con &quot;esta es una prueba&quot; seguido de las palabras que quieres usar. Ej: &quot;esta es una prueba amor lluvia noche corazón solo&quot;"
                value={historia}
                onChange={e => setHistoria(e.target.value)}
              />
              <span className="char-count">{historia.length} caracteres</span>
            </div>

            <button className="btn-primary" onClick={handleGenerar} disabled={generando}>
              {generando ? <span className="btn-spinner">Generando...</span> : '✨ Generar Parodia'}
            </button>

            {parodiaActual && (
              <div className="resultado">
                <div className="resultado-header">
                  <h3>
                    Parodia generada
                    {parodiaActual.modoPrueba && (
                      <span style={{
                        marginLeft: '0.6rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        background: 'rgba(250,204,21,0.15)',
                        border: '1px solid #facc15',
                        color: '#facc15',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        verticalAlign: 'middle',
                      }}>
                        🧪 Modo prueba
                      </span>
                    )}
                  </h3>
                  <div className="resultado-actions">
                    <button className="btn-secondary" onClick={handleCopiar}>📋 Copiar</button>
                    <button
                      className="btn-primary btn-small"
                      onClick={handleGuardar}
                      disabled={guardada}
                    >
                      {guardada ? '✅ Guardada' : '💾 Guardar'}
                    </button>
                  </div>
                </div>
                <pre className="parodia-texto">{parodiaActual.parodia}</pre>
              </div>
            )}
          </>
        ) : (
          <div className="no-song-msg">
            <span className="no-song-icon">🎶</span>
            <p>Selecciona una canción de la lista para comenzar</p>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Tab: Mi Colección ──────────────────────────────────────────────────
function ModalMenuNumerado({ canciones, onClose }: { canciones: Cancion[]; onClose: () => void }) {
  const texto = canciones.map((c, i) => `${i + 1}. ${c.nombre}`).join('\n');

  function copiar() {
    navigator.clipboard.writeText(texto)
      .then(() => alert('¡Menú copiado al portapapeles!'))
      .catch(() => alert('No se pudo copiar'));
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '1.5rem',
        maxWidth: 480, width: '100%', maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', gap: '1rem',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
            📋 Menú de canciones ({canciones.length})
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>

        {/* Lista */}
        <div style={{
          overflowY: 'auto', flex: 1,
          background: 'var(--surface2)', borderRadius: 'var(--radius-sm)',
          padding: '1rem', fontFamily: 'Fira Mono, monospace', fontSize: '0.88rem',
          lineHeight: 2, border: '1px solid var(--border)',
        }}>
          {canciones.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', gap: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>{i + 1}.</span>
              <span style={{ color: 'var(--text)' }}>{c.nombre}</span>
            </div>
          ))}
        </div>

        {/* Botón copiar */}
        <button className="btn-primary" onClick={copiar} style={{ alignSelf: 'flex-start' }}>
          📋 Copiar al portapapeles
        </button>
      </div>
    </div>
  );
}

function TabColeccion({
  canciones,
  showToast,
  onVerLetra,
  onCancionEliminada,
  onAbrirAgregar,
  onEditar,
}: {
  canciones: Cancion[];
  showToast: (msg: string, type?: 'success' | 'error' | '') => void;
  onVerLetra: (cancion: Cancion) => void;
  onCancionEliminada: () => void;
  onAbrirAgregar: () => void;
  onEditar: (cancion: Cancion) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [verMenu, setVerMenu]   = useState(false);

  const cancionesFiltradas = canciones.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.estilo.toLowerCase().includes(busqueda.toLowerCase())
  );

  async function eliminarCancion(id: string, nombre: string) {
    if (!confirm(`¿Eliminar "${nombre}" de la colección?`)) return;
    try {
      const res = await fetch(`/api/canciones/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast(`"${nombre}" eliminada`, 'success');
      onCancionEliminada();
    } catch {
      showToast('Error al eliminar la canción', 'error');
    }
  }

  return (
    <>
      {verMenu && <ModalMenuNumerado canciones={canciones} onClose={() => setVerMenu(false)} />}
      <div className="coleccion-header">
        <h2>Mi Colección de Canciones</h2>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="search"
            placeholder="Buscar…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{
              padding: '0.4rem 0.7rem', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'var(--surface-2)',
              color: 'var(--text)', fontSize: '0.85rem', width: '200px',
            }}
          />
          <button className="btn-secondary" onClick={() => setVerMenu(true)}>📋 Menú numerado</button>
          <button className="btn-primary" onClick={onAbrirAgregar}>+ Agregar Canción</button>
        </div>
      </div>
      <div className="songs-grid">
        {canciones.length === 0 ? (
          <div className="empty-msg">No hay canciones. ¡Agrega la primera!</div>
        ) : cancionesFiltradas.length === 0 ? (
          <div className="empty-msg">Sin resultados para &quot;{busqueda}&quot;</div>
        ) : (
          cancionesFiltradas.map(c => (
            <div key={c.id} className="song-card">
              <span className="song-card-name">{c.nombre}</span>
              <span className="badge">{c.estilo}</span>
              {c.descripcionEstilo && (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{c.descripcionEstilo}</p>
              )}
              <p className="song-card-preview">{c.letra.replace(/\[.*?\]\n/g, '')}</p>
              <div className="song-card-footer">
                <button className="btn-icon" onClick={() => onVerLetra(c)}>📄 Ver letra</button>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn-icon" onClick={() => onEditar(c)}>✏️ Editar</button>
                  <button className="btn-danger" onClick={() => eliminarCancion(c.id, c.nombre)}>🗑 Eliminar</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

// ── Tab: Mis Creaciones ────────────────────────────────────────────────
function CreacionItem({
  c,
  showToast,
  onVer,
  onEliminada,
  onUrlGuardada,
}: {
  c: Creacion;
  showToast: (msg: string, type?: 'success' | 'error' | '') => void;
  onVer: () => void;
  onEliminada: () => void;
  onUrlGuardada: (id: string, url: string) => void;
}) {
  const [editandoUrl, setEditandoUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(c.urlCancion ?? '');
  const [playerAbierto, setPlayerAbierto] = useState(false);

  async function guardarUrl(e: React.MouseEvent | React.FormEvent) {
    e.stopPropagation();
    (e as React.FormEvent).preventDefault?.();
    try {
      const res = await fetch(`/api/parodias/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlCancion: urlInput.trim() }),
      });
      if (!res.ok) throw new Error();
      onUrlGuardada(c.id, urlInput.trim());
      setEditandoUrl(false);
      showToast('URL guardada', 'success');
    } catch {
      showToast('Error al guardar la URL', 'error');
    }
  }

  async function eliminar(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('¿Eliminar esta parodia?')) return;
    try {
      const res = await fetch(`/api/parodias/${c.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Parodia eliminada', 'success');
      onEliminada();
    } catch {
      showToast('Error al eliminar', 'error');
    }
  }

  return (
    <div className="creacion-card">
      <div className="creacion-card-top" onClick={onVer}>
        <div className="creacion-info">
          <span className="creacion-titulo">Parodia de &quot;{c.cancion_base}&quot;</span>
          {c.estilo && <span className="song-item-style">🎼 {c.estilo}</span>}
          <span className="creacion-historia">💡 {c.historia}</span>
        </div>
        <div className="creacion-actions">
          <span className="creacion-fecha">{formatDate(c.fecha)}</span>
          <button className="btn-danger" onClick={eliminar}>🗑</button>
        </div>
      </div>

      <div className="creacion-url-row" onClick={e => e.stopPropagation()}>
        {editandoUrl ? (
          <form className="creacion-url-form" onSubmit={guardarUrl}>
            <input
              type="url"
              className="creacion-url-input"
              placeholder="https://www.youtube.com/watch?v=..."
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-icon">Guardar</button>
            <button type="button" className="btn-icon" onClick={e => { e.stopPropagation(); setEditandoUrl(false); setUrlInput(c.urlCancion ?? ''); }}>✕</button>
          </form>
        ) : (
          <div className="creacion-url-actions">
            {c.urlCancion ? (
              <button className="btn-primary btn-small" onClick={e => { e.stopPropagation(); setPlayerAbierto(p => !p); }}>
                {playerAbierto ? '⏹ Cerrar player' : '▶ Escuchar'}
              </button>
            ) : (
              <span className="creacion-url-empty">Sin URL</span>
            )}
            <button className="btn-icon" onClick={e => { e.stopPropagation(); setPlayerAbierto(false); setEditandoUrl(true); }}>
              {c.urlCancion ? '✏️ Editar URL' : '🔗 Agregar URL'}
            </button>
          </div>
        )}
        {playerAbierto && c.urlCancion && (
          <PlayerEmbed url={c.urlCancion} onClose={() => setPlayerAbierto(false)} />
        )}
      </div>
    </div>
  );
}

function TabCreaciones({
  showToast,
  onVerCreacion,
}: {
  showToast: (msg: string, type?: 'success' | 'error' | '') => void;
  onVerCreacion: (c: Creacion) => void;
}) {
  const [creaciones, setCreaciones] = useState<Creacion[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch('/api/parodias');
      const data = await res.json();
      setCreaciones(Array.isArray(data) ? data : []);
      if (!res.ok) showToast(data.error || 'Error al cargar creaciones', 'error');
    } catch {
      showToast('Error al cargar creaciones', 'error');
    } finally {
      setCargando(false);
    }
  }, [showToast]);

  useEffect(() => { cargar(); }, [cargar]);

  function actualizarUrl(id: string, url: string) {
    setCreaciones(prev => prev.map(c => c.id === id ? { ...c, urlCancion: url } : c));
  }

  if (cargando) return <div className="loading-msg">Cargando...</div>;

  return (
    <>
      <div className="coleccion-header">
        <h2>Mis Creaciones</h2>
        <span className="subtitle">Parodias guardadas</span>
      </div>
      <div className="creaciones-list">
        {creaciones.length === 0 ? (
          <div className="empty-msg">Aún no tienes parodias guardadas. ¡Crea la primera!</div>
        ) : (
          creaciones.map(c => (
            <CreacionItem
              key={c.id}
              c={c}
              showToast={showToast}
              onVer={() => onVerCreacion(c)}
              onEliminada={cargar}
              onUrlGuardada={actualizarUrl}
            />
          ))
        )}
      </div>
    </>
  );
}

// ── Modal: Ver Creación ────────────────────────────────────────────────
function CampoCopiable({ label, valor, mono = false }: { label: string; valor: string; mono?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  function copiar() {
    navigator.clipboard.writeText(valor).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }
  return (
    <div className="campo-copiable">
      <div className="campo-copiable-header">
        <span className="campo-copiable-label">{label}</span>
        <button className="btn-icon-xs" onClick={copiar}>{copiado ? '✅ Copiado' : '📋 Copiar'}</button>
      </div>
      <div className={mono ? 'campo-copiable-body mono' : 'campo-copiable-body'}>{valor}</div>
    </div>
  );
}

function ModalCreacion({ creacion: c, onClose }: { creacion: Creacion; onClose: () => void }) {
  const [playerAbierto, setPlayerAbierto] = useState(false);
  return (
    <Modal onClose={onClose} large>
      <div className="modal-header">
        <h3>Parodia de &quot;{c.cancion_base}&quot;</h3>
        <button className="btn-close" onClick={onClose}>✕</button>
      </div>

      <div className="campos-creacion">
        {/* Canción + player */}
        <div className="campo-copiable">
          <div className="campo-copiable-header">
            <span className="campo-copiable-label">🎵 Canción base</span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {c.urlCancion && (
                <button className="btn-primary btn-small" onClick={() => setPlayerAbierto(p => !p)}>
                  {playerAbierto ? '⏹ Cerrar' : '▶ Escuchar'}
                </button>
              )}
              <button className="btn-icon-xs" onClick={() => navigator.clipboard.writeText(c.cancion_base)}>📋 Copiar</button>
            </div>
          </div>
          <div className="campo-copiable-body">{c.cancion_base}</div>
          {playerAbierto && c.urlCancion && (
            <PlayerEmbed url={c.urlCancion} onClose={() => setPlayerAbierto(false)} />
          )}
        </div>

        {c.estilo && <CampoCopiable label="🎼 Estilo" valor={c.estilo + (c.descripcionEstilo ? ` — ${c.descripcionEstilo}` : '')} />}
        {c.direccionGenerador && <CampoCopiable label="🧭 Dirección en Generador" valor={c.direccionGenerador} />}
        <CampoCopiable label="💡 Historia / Temática" valor={c.historia} />
        <CampoCopiable label="🎤 Parodia generada" valor={c.parodia} mono />
      </div>
    </Modal>
  );
}

// ── Página principal ───────────────────────────────────────────────────
export default function Home() {
  const [tab, setTab] = useState<Tab>('crear');
  const [canciones, setCanciones] = useState<Cancion[]>([]);
  const [toast, setToast] = useState<Toast>(null);
  const [modalLetra, setModalLetra] = useState<Cancion | null>(null);
  const [modalCancion, setModalCancion] = useState<{ open: boolean; cancion?: Cancion }>({ open: false });
  const [modalCreacion, setModalCreacion] = useState<Creacion | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' | '' = '') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const cargarCanciones = useCallback(async () => {
    try {
      const res = await fetch('/api/canciones');
      const data = await res.json();
      const lista: Cancion[] = Array.isArray(data) ? data : [];
      lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
      setCanciones(lista);
      if (!res.ok) showToast(data.error || 'Error al cargar canciones', 'error');
    } catch {
      showToast('Error al cargar canciones', 'error');
    }
  }, []);

  useEffect(() => { cargarCanciones(); }, [cargarCanciones]);

  function abrirCrear() { setModalCancion({ open: true }); }
  function abrirEditar(c: Cancion) { setModalCancion({ open: true, cancion: c }); }
  function cerrarModal() { setModalCancion({ open: false }); }

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🎵</span>
            <span className="logo-text">Canciones</span>
          </div>
          <nav className="nav">
            {(['crear', 'coleccion', 'creaciones'] as Tab[]).map(t => (
              <button
                key={t}
                className={`nav-btn ${tab === t ? 'active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t === 'crear' ? 'Crear Parodia' : t === 'coleccion' ? 'Mi Colección' : 'Mis Creaciones'}
              </button>
            ))}
            <a href="/karaoke" className="nav-btn">🎤 Karaoke</a>
            <a href="/video" className="nav-btn">🎬 Video</a>
            <a href="/guitarra" className="nav-btn">🎸 Guitarra</a>
            <a href="/piano" className="nav-btn">🎹 Piano</a>
            <a href="/recortar" className="nav-btn">✂️ Recortar</a>
          </nav>
        </div>
      </header>

      <main className="main">
        {tab === 'crear' && (
          <TabCrear
            canciones={canciones}
            showToast={showToast}
            onVerLetra={setModalLetra}
            onAbrirAgregar={abrirCrear}
            onEditar={abrirEditar}
            onEliminada={cargarCanciones}
          />
        )}
        {tab === 'coleccion' && (
          <TabColeccion
            canciones={canciones}
            showToast={showToast}
            onVerLetra={setModalLetra}
            onCancionEliminada={cargarCanciones}
            onAbrirAgregar={abrirCrear}
            onEditar={abrirEditar}
          />
        )}
        {tab === 'creaciones' && (
          <TabCreaciones
            showToast={showToast}
            onVerCreacion={setModalCreacion}
          />
        )}
      </main>

      {/* Modal: Ver letra */}
      {modalLetra && (
        <Modal onClose={() => setModalLetra(null)}>
          <div className="modal-header">
            <h3>Letra original — {modalLetra.nombre}</h3>
            <button className="btn-close" onClick={() => setModalLetra(null)}>✕</button>
          </div>
          <pre className="modal-letra-pre">{modalLetra.letra}</pre>
        </Modal>
      )}

      {/* Modal: Crear / Editar canción */}
      {modalCancion.open && (
        <ModalCancion
          cancion={modalCancion.cancion}
          onClose={cerrarModal}
          onGuardada={cargarCanciones}
          showToast={showToast}
        />
      )}

      {/* Modal: Ver creación */}
      {modalCreacion && (
        <ModalCreacion creacion={modalCreacion} onClose={() => setModalCreacion(null)} />
      )}

      <ToastNotification toast={toast} />
    </>
  );
}
