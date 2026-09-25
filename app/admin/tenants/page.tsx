'use client';
import { useState, useEffect, useCallback } from 'react';

type Tenant = {
  telefono: string;
  fechaRegistro: string;
  cancionesGratisUsadas: number;
  cancionesGratisLimite: number;
  saldo: number;
  ultimaParodia?: { cancion_base: string; fecha: string };
  codigoAcceso: string | null;
  plan?: 'freemium' | 'premium';
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Para ubicar de un vistazo quién lleva tiempo sin usar la app — más
// legible que la fecha completa cuando lo que importa es "hace cuánto".
function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

function urlEnviarCodigo(telefono: string, codigo: string): string {
  const mensaje = `Tu código de acceso a corridos.online es: ${codigo}\nUsalo en "¿Ya tenés un código de acceso?" si alguna vez perdés la sesión.`;
  return `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
}

// Sin texto prellenado a propósito — este es para cualquier otro tipo de
// mensaje (avisos, soporte, promos), no el código de acceso, así que se
// abre la conversación en blanco y el admin escribe lo que corresponda.
function urlEnviarMensaje(telefono: string): string {
  return `https://wa.me/${telefono}`;
}

// Sin +504 ni guion a propósito — el número tal cual lo tipearía la
// persona en el formulario de "¿Ya tenés un código de acceso?", para que
// lo reconozca de un vistazo sin tener que pensar en formato.
function soloNumeroLocal(digits: string): string {
  return digits.startsWith('504') && digits.length === 11 ? digits.slice(3) : digits;
}

function urlAltaRapida(telefono: string, codigo: string): string {
  const mensaje = `Con gusto te presentamos la aplicación https://corridos.online — Para ingresar vas a necesitar tu número de teléfono (${soloNumeroLocal(telefono)}) y tu código de acceso: ${codigo}\n\nImportante: tenés que entrar con este mismo número — si usás otro, no te va a funcionar.`;
  return `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
}

// Función exclusiva del admin para acreditar saldo directo, sin pasar por
// ninguna solicitud del tenant — pensada para usarse recién después de
// confirmar el comprobante de depósito que llega por WhatsApp, no en base
// a lo que el tenant reporte dentro de la app (de ahí venían los "pedidos
// de depósito" falsos).
function CeldaSaldo({ telefono, saldo, onActualizado }: { telefono: string; saldo: number; onActualizado: () => void }) {
  const [editando, setEditando] = useState(false);
  const [monto, setMonto] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function agregar() {
    const n = Number(monto);
    if (!n || n <= 0) return;
    setGuardando(true);
    try {
      const res = await fetch('/api/admin/tenants/agregar-saldo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono, monto: n }),
      });
      if (res.ok) {
        setEditando(false);
        setMonto('');
        onActualizado();
      }
    } finally {
      setGuardando(false);
    }
  }

  if (editando) {
    return (
      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
        <input
          type="number"
          min={1}
          placeholder="L"
          value={monto}
          onChange={e => setMonto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') agregar(); if (e.key === 'Escape') setEditando(false); }}
          className="input"
          style={{ width: 64, padding: '0.25rem 0.4rem', fontSize: '0.78rem' }}
          autoFocus
        />
        <button className="btn-primary" disabled={guardando || !monto} onClick={agregar} style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}>
          {guardando ? '...' : '✓'}
        </button>
        <button className="btn-secondary" onClick={() => { setEditando(false); setMonto(''); }} style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      {saldo > 0 ? (
        <span className="badge" style={{ background: 'rgba(78,201,160,0.14)', borderColor: 'var(--success)', color: 'var(--success)' }}>
          L {saldo}
        </span>
      ) : `L ${saldo ?? 0}`}
      <button
        className="btn-icon-xs"
        title="Agregar saldo manualmente (solo tras confirmar el comprobante de depósito por WhatsApp)"
        onClick={() => setEditando(true)}
      >
        ➕
      </button>
    </div>
  );
}

type PedidoResumen = { id: string; cancion_base: string; fecha: string; estado: string; tieneLink: boolean };
type RecargaResumen = { id: string; monto: number; credito: number; estado: string; fecha: string };
type InfoBorrado = {
  tenant: Tenant;
  pedidos: PedidoResumen[];
  recargas: RecargaResumen[];
  verificacionesCount: number;
};

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal">
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal-box">{children}</div>
    </div>
  );
}

// Muestra la misma info que antes había que revisar a mano en Firestore
// (pedidos, recargas, verificaciones) antes de borrar un tenant, y pide
// confirmación explícita — nunca borra directo al click del basurero.
function ModalConfirmarBorrado({ telefono, onClose, onBorrado }: { telefono: string; onClose: () => void; onBorrado: () => void }) {
  const [info, setInfo] = useState<InfoBorrado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/admin/tenants/${telefono}`)
      .then(res => res.json())
      .then(data => setInfo(data))
      .catch(() => setError('No se pudo cargar la información'))
      .finally(() => setCargando(false));
  }, [telefono]);

  async function confirmar() {
    setBorrando(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/tenants/${telefono}`, { method: 'DELETE' });
      if (!res.ok) { setError('No se pudo borrar el tenant'); return; }
      onBorrado();
      onClose();
    } catch {
      setError('Error de conexión');
    } finally {
      setBorrando(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-header">
        <h3>¿Borrar el tenant {telefono}?</h3>
        <button className="btn-close" onClick={onClose}>✕</button>
      </div>

      {cargando ? (
        <p className="loading-msg">Cargando…</p>
      ) : !info ? (
        <p style={{ color: 'var(--error)' }}>⚠️ No se pudo cargar la información de este tenant.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.88rem' }}>
          <div>
            Registrado {formatFecha(info.tenant.fechaRegistro)} · saldo <strong>L {info.tenant.saldo}</strong> · {info.tenant.plan === 'premium' ? '⭐ Premium' : 'Freemium'}
          </div>

          <div>
            <strong>Pedidos ({info.pedidos.length})</strong>
            {info.pedidos.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>Ninguno.</p>
            ) : (
              <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.2rem' }}>
                {info.pedidos.map(p => (
                  <li key={p.id} style={{ color: 'var(--text-muted)' }}>
                    {p.cancion_base} — {formatFecha(p.fecha)} · {p.estado}{p.tieneLink ? ' · con link compartido' : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <strong>Recargas ({info.recargas.length})</strong>
            {info.recargas.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>Ninguna.</p>
            ) : (
              <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.2rem' }}>
                {info.recargas.map(r => (
                  <li key={r.id} style={{ color: r.estado === 'pendiente' ? 'var(--warning, #d99a2b)' : 'var(--text-muted)' }}>
                    L {r.monto} → L {r.credito} · {r.estado} · {formatFecha(r.fecha)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <strong>Verificaciones:</strong> {info.verificacionesCount}
          </div>

          {(info.pedidos.length > 0 || info.recargas.some(r => r.estado === 'pendiente') || info.tenant.saldo > 0) && (
            <p style={{ color: 'var(--warning, #d99a2b)', fontSize: '0.82rem', margin: 0 }}>
              ⚠️ Esta cuenta no está vacía — revisá arriba antes de confirmar.
            </p>
          )}

          {error && <p style={{ color: 'var(--error)', margin: 0 }}>⚠️ {error}</p>}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn-danger" disabled={borrando} onClick={confirmar}>
              {borrando ? 'Borrando...' : '🗑️ Sí, borrar todo'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [telefonoAlta, setTelefonoAlta] = useState('');
  const [creandoAlta, setCreandoAlta] = useState(false);
  const [errorAlta, setErrorAlta] = useState('');
  const [altaCreada, setAltaCreada] = useState<{ telefono: string; codigo: string } | null>(null);
  // 'asc' en esta columna = los más inactivos primero (fecha más vieja o
  // nunca usada) — es el orden que sirve para el caso real: ubicar rápido
  // a quién hay que reactivar.
  const [ordenActividad, setOrdenActividad] = useState<'asc' | 'desc' | null>(null);
  const [tenantABorrar, setTenantABorrar] = useState<string | null>(null);

  const cargarTenants = useCallback(() => {
    return fetch('/api/admin/tenants')
      .then(res => res.json())
      .then(data => setTenants(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    cargarTenants().finally(() => setCargando(false));
  }, [cargarTenants]);

  // Fast-track: dado el número que un prospecto ya escribió por WhatsApp
  // (ej. desde el anuncio), crea la cuenta ya aprobada. El código llega
  // recién de la respuesta del servidor — no se puede abrir WhatsApp
  // automático en ese momento (ya no es un gesto directo del usuario, los
  // navegadores lo bloquean como popup), así que se muestra un botón para
  // que el admin lo abra con un click, mismo patrón que el resto de esta
  // tabla (columna "Código de acceso").
  async function altaRapida() {
    if (!telefonoAlta.trim()) return;
    setCreandoAlta(true);
    setErrorAlta('');
    setAltaCreada(null);
    try {
      const res = await fetch('/api/admin/alta-rapida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: telefonoAlta.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorAlta(data.error || 'No se pudo crear la cuenta'); return; }
      setAltaCreada({ telefono: data.telefono, codigo: data.codigo });
      setTelefonoAlta('');
      await cargarTenants();
    } catch {
      setErrorAlta('Error de conexión con el servidor');
    } finally {
      setCreandoAlta(false);
    }
  }

  const filtrados = tenants
    .filter(t => t.telefono.includes(busqueda.replace(/\D/g, '')))
    .sort((a, b) => {
      if (!ordenActividad) return 0;
      // Sin ultimaParodia = nunca la usaron — siempre va primero al ordenar
      // "más inactivos primero" (asc), porque es peor que cualquier fecha vieja.
      const fa = a.ultimaParodia?.fecha ?? '';
      const fb = b.ultimaParodia?.fecha ?? '';
      const cmp = fa.localeCompare(fb);
      return ordenActividad === 'asc' ? cmp : -cmp;
    });

  function alternarOrden() {
    setOrdenActividad(o => (o === 'asc' ? 'desc' : 'asc'));
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <header className="header">
        <div className="header-inner">
          <div className="logo"><span className="logo-icon">🎵</span><span className="logo-text">Canciones</span></div>
          <a href="/admin" className="nav-btn">← Volver</a>
        </div>
      </header>

      <main className="main" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 900, margin: '0 auto', padding: '1.5rem' }}>
        <section className="panel" style={{ padding: '1.25rem' }}>
          <h2 style={{ margin: '0 0 0.5rem' }}>⚡ Alta rápida</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
            Para alguien que ya te escribió por WhatsApp (ej. desde el anuncio) — crea la cuenta ya aprobada y le abre WhatsApp con el código de acceso listo.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="tel"
              placeholder="Número de teléfono…"
              value={telefonoAlta}
              onChange={e => setTelefonoAlta(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') altaRapida(); }}
              className="input"
              style={{ flex: '1 1 200px', boxSizing: 'border-box' }}
            />
            <button className="btn-primary" disabled={creandoAlta || !telefonoAlta.trim()} onClick={altaRapida}>
              {creandoAlta ? '⏳ Creando...' : '⚡ Crear cuenta y enviar código'}
            </button>
          </div>
          {errorAlta && <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginTop: '0.5rem' }}>⚠️ {errorAlta}</p>}
          {altaCreada && (
            <div style={{
              marginTop: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--success)', background: 'rgba(78,201,160,0.08)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: '0.85rem' }}>
                ✅ Cuenta creada para <strong>{altaCreada.telefono}</strong> — código <strong>{altaCreada.codigo}</strong>
              </span>
              <a
                href={urlAltaRapida(altaCreada.telefono, altaCreada.codigo)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
              >
                📲 Abrir WhatsApp y enviar
              </a>
            </div>
          )}
        </section>

        <section className="panel" style={{ padding: '1.25rem' }}>
          <h2 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Tenants registrados
            {!cargando && <span className="badge">{tenants.length}</span>}
          </h2>

          <input
            type="search"
            placeholder="Buscar por teléfono…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="input"
            style={{ width: '100%', marginBottom: '1rem', boxSizing: 'border-box' }}
          />

          {cargando ? (
            <p className="loading-msg">Cargando…</p>
          ) : filtrados.length === 0 ? (
            <p className="empty-msg">No hay tenants que coincidan.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Teléfono</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Registrado</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Saldo</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Gratis usada</th>
                    <th
                      style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      onClick={alternarOrden}
                      title="Ordenar por inactividad"
                    >
                      Última parodia
                      {ordenActividad === 'asc' && ' ▲'}
                      {ordenActividad === 'desc' && ' ▼'}
                    </th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Código de acceso</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>WhatsApp</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(t => (
                    <tr key={t.telefono} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <div style={{ fontWeight: 600 }}>{t.telefono}</div>
                        {t.plan === 'premium' ? (
                          <span style={{ fontSize: '0.7rem', color: '#f2b705' }}>⭐ Premium</span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Freemium</span>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)' }}>{formatFecha(t.fechaRegistro)}</td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <CeldaSaldo telefono={t.telefono} saldo={t.saldo} onActualizado={cargarTenants} />
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>{t.cancionesGratisUsadas}/{t.cancionesGratisLimite}</td>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)' }}>
                        {t.ultimaParodia?.fecha ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span>{t.ultimaParodia.cancion_base}</span>
                            <span style={{ fontSize: '0.72rem' }}>
                              {formatFecha(t.ultimaParodia.fecha)} · hace {diasDesde(t.ultimaParodia.fecha)} día{diasDesde(t.ultimaParodia.fecha) === 1 ? '' : 's'}
                            </span>
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        {t.codigoAcceso ? (
                          <a
                            href={urlEnviarCodigo(t.telefono, t.codigoAcceso)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary"
                            style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', textDecoration: 'none' }}
                          >
                            📲 {t.codigoAcceso}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>vencido</span>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <a
                          href={urlEnviarMensaje(t.telefono)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary"
                          style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', textDecoration: 'none' }}
                        >
                          💬 Mensaje
                        </a>
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <button
                          className="btn-icon-xs danger"
                          title="Borrar tenant"
                          onClick={() => setTenantABorrar(t.telefono)}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {tenantABorrar && (
        <ModalConfirmarBorrado
          telefono={tenantABorrar}
          onClose={() => setTenantABorrar(null)}
          onBorrado={cargarTenants}
        />
      )}
    </div>
  );
}
