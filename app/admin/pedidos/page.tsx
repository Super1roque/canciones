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
};

type Recarga = {
  id: string;
  telefono: string;
  monto: number;
  credito: number;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  fecha: string;
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

function ModalPedido({ pedido: p, onClose }: { pedido: Pedido; onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <div className="modal-header">
        <h3>Pedido de &quot;{p.cancion_base}&quot; — {p.telefono}</h3>
        <button className="btn-close" onClick={onClose}>✕</button>
      </div>
      <div className="campos-creacion">
        {p.estilo && <CampoCopiable label="🎼 Estilo" valor={p.estilo + (p.descripcionEstilo ? ` — ${p.descripcionEstilo}` : '')} />}
        <CampoCopiable label="💡 Historia" valor={p.historia} />
        <CampoCopiable label="🎤 Parodia generada" valor={p.parodia} mono />
      </div>
    </Modal>
  );
}

export default function AdminPedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [recargas, setRecargas] = useState<Recarga[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [pedidoAbierto, setPedidoAbierto] = useState<Pedido | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const [pRes, rRes] = await Promise.all([fetch('/api/admin/pedidos'), fetch('/api/admin/recargas')]);
    setPedidos(pRes.ok ? await pRes.json() : []);
    setRecargas(rRes.ok ? await rRes.json() : []);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function marcarEntregado(id: string) {
    setOcupado(id);
    await fetch('/api/admin/pedidos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await cargar();
    setOcupado(null);
  }

  async function resolverRecarga(id: string, aprobar: boolean) {
    setOcupado(id);
    await fetch('/api/admin/recargas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, aprobar }),
    });
    await cargar();
    setOcupado(null);
  }

  const recargasPendientes = recargas.filter(r => r.estado === 'pendiente');

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
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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

      {pedidoAbierto && <ModalPedido pedido={pedidoAbierto} onClose={() => setPedidoAbierto(null)} />}
    </div>
  );
}
