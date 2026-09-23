'use client';
import { useState, useEffect, useCallback } from 'react';

type Pedido = {
  id: string;
  cancion_base: string;
  estilo: string;
  descripcionEstilo: string;
  historia: string;
  parodia: string;
  telefono: string;
  fecha: string;
  estado: 'pendiente' | 'entregada';
  costo: number;
  cancionCompartidaId?: string;
};

type Recarga = {
  id: string;
  telefono: string;
  monto: number;
  credito: number;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  fecha: string;
};

type Verificacion = {
  id: string;
  telefono: string;
  codigo: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  fecha: string;
};

type CancionCompartida = {
  id: string;
  titulo: string;
  fecha: string;
  reproducciones: number;
};

type TenantPlan = {
  telefono: string;
  plan?: 'freemium' | 'premium';
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Mismo tope que el paywall real de /cancion/[id] (ver
// app/cancion/[id]/page.tsx) — esta barra es solo para que el admin vea
// de un vistazo a quién le falta poco o ya se le venció, no decide nada
// por su cuenta.
const HORAS_LIMITE_GRATIS = 72;

function horasDesde(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

function BarraLimiteGratis({ fechaCancion, premium }: { fechaCancion: string; premium: boolean }) {
  if (premium) {
    return <span style={{ fontSize: '0.72rem', color: '#f2b705', whiteSpace: 'nowrap' }}>⭐ Premium — sin límite</span>;
  }

  const horas = horasDesde(fechaCancion);
  const vencida = horas >= HORAS_LIMITE_GRATIS;
  const pct = Math.min(100, (horas / HORAS_LIMITE_GRATIS) * 100);
  const color = vencida ? 'var(--error)' : horas >= HORAS_LIMITE_GRATIS * 0.85 ? '#d99a2b' : 'var(--success)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 130 }} title={`Se sube el ${HORAS_LIMITE_GRATIS}h del límite gratis`}>
      <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
      <span style={{ fontSize: '0.7rem', color: vencida ? 'var(--error)' : 'var(--text-muted)' }}>
        {vencida
          ? `🔒 Bloqueada hace ${Math.floor(horas - HORAS_LIMITE_GRATIS)}h`
          : `${Math.floor(horas)}h / ${HORAS_LIMITE_GRATIS}h`}
      </span>
    </div>
  );
}

function urlEnviarCodigo(telefono: string, codigo: string): string {
  const mensaje = `Tu código de acceso a corridos.online es: ${codigo}\nUsalo en "¿Ya tenés un código de acceso?" si alguna vez perdés la sesión.`;
  return `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
}

const MENSAJE_AVISO_PROCESO_DEFAULT = 'Su canción ya está en proceso. Le llegará por este medio — cuando el sistema está muy cargado, suele demorar hasta una hora.';

function urlAvisoProceso(telefono: string, mensaje: string): string {
  return `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal">
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal-box modal-box-lg">{children}</div>
    </div>
  );
}

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

function ModalPedido({ pedido: p, reproducciones, onClose, onVinculado }: { pedido: Pedido; reproducciones?: number; onClose: () => void; onVinculado: () => void }) {
  const [cancionCompartidaId, setCancionCompartidaId] = useState(p.cancionCompartidaId);
  const [archivo, setArchivo] = useState<File | null>(null);
  // Precargado con el nombre de la canción base, pero editable — a veces
  // conviene compartirla con un título distinto (ej. con el nombre de la
  // persona en vez de solo la canción original).
  const [tituloCompartir, setTituloCompartir] = useState(p.cancion_base);
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState('');
  const [desvinculando, setDesvinculando] = useState(false);
  // Editable porque a veces conviene ajustarlo al caso (ej. avisar que ya
  // se entregó, o dar un tiempo distinto) antes de mandarlo.
  const [mensajeAviso, setMensajeAviso] = useState(MENSAJE_AVISO_PROCESO_DEFAULT);

  async function subirCancion() {
    if (!archivo) return;
    if (!tituloCompartir.trim()) { setErrorSubida('Ponele un título a la canción'); return; }
    setSubiendo(true);
    setErrorSubida('');
    try {
      const fd = new FormData();
      fd.append('file', archivo);
      fd.append('titulo', tituloCompartir.trim());
      fd.append('pedidoId', p.id);
      const res = await fetch('/api/canciones-compartidas/upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErrorSubida(data.error || `Error al subir (${res.status})`); return; }
      setCancionCompartidaId(data.id);
      onVinculado();
    } catch {
      setErrorSubida('Error de conexión');
    } finally {
      setSubiendo(false);
    }
  }

  // Para cuando se subió el audio equivocado — borra el link y el archivo
  // por completo (no queda huérfano) y deja el modal como si nunca se
  // hubiera generado, para poder subir el correcto.
  async function quitarEnlace() {
    if (!cancionCompartidaId) return;
    if (!confirm('¿Quitar este enlace? Se borra el audio subido y el pedido queda sin link, como si nunca se hubiera generado.')) return;
    setDesvinculando(true);
    try {
      const res = await fetch('/api/admin/pedidos/desvincular-cancion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId: p.id }),
      });
      if (!res.ok) { setErrorSubida('No se pudo quitar el enlace'); return; }
      setCancionCompartidaId(undefined);
      setTituloCompartir(p.cancion_base);
      onVinculado();
    } catch {
      setErrorSubida('Error de conexión');
    } finally {
      setDesvinculando(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-header">
        <h3>Pedido de &quot;{p.cancion_base}&quot; — {p.telefono}</h3>
        <button className="btn-close" onClick={onClose}>✕</button>
      </div>
      <div className="campos-creacion">
        <div className="campo-copiable">
          <div className="campo-copiable-header">
            <span className="campo-copiable-label">📲 Avisar que está en proceso</span>
          </div>
          <textarea
            value={mensajeAviso}
            onChange={e => setMensajeAviso(e.target.value)}
            rows={3}
            className="input"
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div style={{ paddingTop: '0.5rem' }}>
            <a
              href={urlAvisoProceso(p.telefono, mensajeAviso)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{ textDecoration: 'none', display: 'inline-block' }}
            >
              📲 Abrir WhatsApp y avisar
            </a>
          </div>
        </div>

        {p.estilo && <CampoCopiable label="🎼 Estilo" valor={p.estilo + (p.descripcionEstilo ? ` — ${p.descripcionEstilo}` : '')} />}
        <CampoCopiable label="💡 Historia" valor={p.historia} />
        <CampoCopiable label="🎤 Parodia generada" valor={p.parodia} mono />

        {cancionCompartidaId ? (
          <>
            <CampoCopiable label="🎧 Link para escuchar" valor={`https://corridos.online/cancion/${cancionCompartidaId}`} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '-0.5rem 0 0' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                ▶️ Reproducida {reproducciones ?? 0} {reproducciones === 1 ? 'vez' : 'veces'}
              </p>
              <button
                className="btn-secondary"
                disabled={desvinculando}
                onClick={quitarEnlace}
                style={{ fontSize: '0.78rem' }}
              >
                {desvinculando ? '...' : '🗑️ Subí el audio equivocado — quitar enlace'}
              </button>
            </div>
          </>
        ) : (
          <div className="campo-copiable">
            <div className="campo-copiable-header">
              <span className="campo-copiable-label">🎧 Compartir esta canción (mp3, hasta 20 MB)</span>
            </div>
            <div style={{ padding: '0.5rem 0 0.25rem' }}>
              <input
                type="text"
                value={tituloCompartir}
                onChange={e => setTituloCompartir(e.target.value)}
                placeholder="Título de la canción"
                className="input"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.5rem 0' }}>
              <input
                type="file"
                accept="audio/*"
                onChange={e => setArchivo(e.target.files?.[0] ?? null)}
              />
              <button className="btn-primary" disabled={!archivo || subiendo} onClick={subirCancion}>
                {subiendo ? '⏳ Subiendo y preparando la letra...' : '🔗 Generar link'}
              </button>
            </div>
          </div>
        )}
        {errorSubida && <p style={{ color: 'var(--error)', fontSize: '0.85rem' }}>⚠️ {errorSubida}</p>}
      </div>
    </Modal>
  );
}

export default function AdminPedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [recargas, setRecargas] = useState<Recarga[]>([]);
  const [verificaciones, setVerificaciones] = useState<Verificacion[]>([]);
  const [cancionesCompartidas, setCancionesCompartidas] = useState<CancionCompartida[]>([]);
  const [tenants, setTenants] = useState<TenantPlan[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [pedidoAbierto, setPedidoAbierto] = useState<Pedido | null>(null);

  // Separado del "cargando" a propósito — el refresco automático de fondo
  // no debe hacer parpadear la lista con el mensaje de "Cargando…" cada
  // vez que se ejecuta, eso queda solo para la primera carga real.
  const cargarSilencioso = useCallback(async () => {
    const [pRes, rRes, vRes, ccRes, tRes] = await Promise.all([
      fetch('/api/admin/pedidos'),
      fetch('/api/admin/recargas'),
      fetch('/api/admin/verificaciones'),
      fetch('/api/admin/canciones-compartidas'),
      fetch('/api/admin/tenants'),
    ]);
    setPedidos(pRes.ok ? await pRes.json() : []);
    setRecargas(rRes.ok ? await rRes.json() : []);
    setVerificaciones(vRes.ok ? await vRes.json() : []);
    setCancionesCompartidas(ccRes.ok ? await ccRes.json() : []);
    setTenants(tRes.ok ? await tRes.json() : []);
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    await cargarSilencioso();
    setCargando(false);
  }, [cargarSilencioso]);

  useEffect(() => { cargar(); }, [cargar]);

  // Refresca solo mientras la pestaña está visible, así no hace falta
  // apretar F5 para ver un pedido/recarga/verificación que acaba de
  // entrar — igual que el polling del dashboard del tenant.
  useEffect(() => {
    function revisar() {
      if (document.visibilityState !== 'visible') return;
      cargarSilencioso();
    }
    const intervalo = setInterval(revisar, 15000);
    document.addEventListener('visibilitychange', revisar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', revisar);
    };
  }, [cargarSilencioso]);

  async function marcarEntregado(id: string) {
    setOcupado(id);
    await fetch('/api/admin/pedidos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await cargarSilencioso();
    setOcupado(null);
  }

  async function resolverRecarga(id: string, aprobar: boolean) {
    setOcupado(id);
    await fetch('/api/admin/recargas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, aprobar }),
    });
    await cargarSilencioso();
    setOcupado(null);
  }

  async function resolverVerificacion(v: Verificacion, aprobar: boolean) {
    // Se abre ANTES del fetch, en el mismo click, para que el navegador no
    // lo bloquee como popup — y porque la tarjeta (con su botón de
    // WhatsApp aparte) desaparece de la lista apenas se aprueba, así que
    // no se puede depender de que el admin haga los dos clicks en orden.
    if (aprobar) window.open(urlEnviarCodigo(v.telefono, v.codigo), '_blank', 'noopener,noreferrer');
    setOcupado(v.id);
    await fetch('/api/admin/verificaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: v.id, aprobar }),
    });
    await cargarSilencioso();
    setOcupado(null);
  }

  const recargasPendientes = recargas.filter(r => r.estado === 'pendiente');
  const verificacionesPendientes = verificaciones.filter(v => v.estado === 'pendiente');
  const reproduccionesPorId = new Map(cancionesCompartidas.map(c => [c.id, c.reproducciones]));
  const fechaCancionPorId = new Map(cancionesCompartidas.map(c => [c.id, c.fecha]));
  const planPorTelefono = new Map(tenants.map(t => [t.telefono, t.plan]));

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
          <h2 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Verificaciones de teléfono pendientes
            {verificacionesPendientes.length > 0 && <span className="badge">{verificacionesPendientes.length}</span>}
          </h2>
          {cargando ? (
            <p className="loading-msg">Cargando…</p>
          ) : verificacionesPendientes.length === 0 ? (
            <p className="empty-msg">No hay verificaciones pendientes.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {verificacionesPendientes.map(v => (
                <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      Teléfono declarado: {v.telefono}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatFecha(v.fecha)}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--warning, #d99a2b)', marginTop: '0.2rem' }}>
                      ⚠️ Aprobá solo si el WhatsApp llegó de este mismo número.
                    </div>
                    <div style={{ marginTop: '0.4rem', maxWidth: 220 }}>
                      <CampoCopiable label="Código de acceso" valor={v.codigo} mono />
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>
                      Al aprobar se abre WhatsApp con el código ya escrito para ese número.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-primary" disabled={ocupado === v.id} onClick={() => resolverVerificacion(v, true)}>
                      {ocupado === v.id ? '...' : '✅ Aprobar y enviar código'}
                    </button>
                    <button className="btn-danger" disabled={ocupado === v.id} onClick={() => resolverVerificacion(v, false)}>
                      ✕ Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel" style={{ padding: '1.25rem' }}>
          <h2 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Recargas pendientes
            {recargasPendientes.length > 0 && <span className="badge">{recargasPendientes.length}</span>}
          </h2>
          {cargando ? (
            <p className="loading-msg">Cargando…</p>
          ) : recargasPendientes.length === 0 ? (
            <p className="empty-msg">No hay recargas pendientes.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {recargasPendientes.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {r.telefono} — paga L {r.monto}
                      {r.credito > r.monto && ` → acreditar L ${r.credito} (bono L ${r.credito - r.monto})`}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatFecha(r.fecha)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-primary" disabled={ocupado === r.id} onClick={() => resolverRecarga(r.id, true)}>
                      {ocupado === r.id ? '...' : '✅ Aprobar'}
                    </button>
                    <button className="btn-danger" disabled={ocupado === r.id} onClick={() => resolverRecarga(r.id, false)}>
                      ✕ Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel" style={{ padding: '1.25rem' }}>
          <h2 style={{ margin: '0 0 1rem' }}>Pedidos de canciones</h2>
          {cargando ? (
            <p className="loading-msg">Cargando…</p>
          ) : pedidos.length === 0 ? (
            <p className="empty-msg">Todavía no hay pedidos.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {pedidos.map(p => (
                <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.cancion_base} — {p.telefono}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatFecha(p.fecha)} · {p.costo > 0 ? `L ${p.costo}` : 'gratis'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {p.cancionCompartidaId && fechaCancionPorId.has(p.cancionCompartidaId) && (
                        <BarraLimiteGratis
                          fechaCancion={fechaCancionPorId.get(p.cancionCompartidaId)!}
                          premium={planPorTelefono.get(p.telefono) === 'premium'}
                        />
                      )}
                      {p.cancionCompartidaId && (
                        <span className="badge" title="Veces que se reprodujo el link compartido">
                          ▶️ {reproduccionesPorId.get(p.cancionCompartidaId) ?? 0}
                        </span>
                      )}
                      <button className="btn-secondary" onClick={() => setPedidoAbierto(p)}>🔍 Revisar</button>
                      {p.estado === 'entregada' ? (
                        <span className="badge" style={{ background: 'rgba(78,201,160,0.14)', borderColor: 'var(--success)', color: 'var(--success)' }}>
                          ✅ Entregada
                        </span>
                      ) : (
                        <button className="btn-primary" disabled={ocupado === p.id} onClick={() => marcarEntregado(p.id)}>
                          {ocupado === p.id ? 'Guardando...' : 'Marcar entregada'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      {pedidoAbierto && (
        <ModalPedido
          pedido={pedidoAbierto}
          reproducciones={pedidoAbierto.cancionCompartidaId ? reproduccionesPorId.get(pedidoAbierto.cancionCompartidaId) : undefined}
          onClose={() => setPedidoAbierto(null)}
          onVinculado={cargarSilencioso}
        />
      )}
    </div>
  );
}
