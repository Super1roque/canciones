'use client';
import { useState, useEffect } from 'react';

type Tenant = {
  telefono: string;
  fechaRegistro: string;
  cancionesGratisUsadas: number;
  cancionesGratisLimite: number;
  saldo: number;
  ultimaParodia?: { cancion_base: string };
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    fetch('/api/admin/tenants')
      .then(res => res.json())
      .then(data => setTenants(Array.isArray(data) ? data : []))
      .finally(() => setCargando(false));
  }, []);

  const filtrados = tenants.filter(t => t.telefono.includes(busqueda.replace(/\D/g, '')));

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
                    <th style={{ padding: '0.5rem 0.75rem' }}>Última parodia</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(t => (
                    <tr key={t.telefono} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>{t.telefono}</td>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)' }}>{formatFecha(t.fechaRegistro)}</td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        {t.saldo > 0 ? (
                          <span className="badge" style={{ background: 'rgba(78,201,160,0.14)', borderColor: 'var(--success)', color: 'var(--success)' }}>
                            L {t.saldo}
                          </span>
                        ) : `L ${t.saldo ?? 0}`}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>{t.cancionesGratisUsadas}/{t.cancionesGratisLimite}</td>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)' }}>{t.ultimaParodia?.cancion_base || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
