'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';

type Tenant = {
  telefono: string;
  fechaRegistro: string;
  cancionesGratisUsadas: number;
  cancionesGratisLimite: number;
};

const DIAS_MINIMOS_DEFAULT = 5;

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

const MENSAJE_INVITACION_DEFAULT = `¡Hola! 👋 Vi que te interesaste en nuestros corridos y quería invitarte a que aproveches tu canción de prueba GRATIS. 🎶

No necesitás imaginar cómo quedaría tu historia convertida en corrido… podés comprobarlo vos mismo. 😃

Entrás, contás tu historia y nuestra aplicación hace el resto.

👉 La primera canción completa es GRATIS.
Probala sin compromiso y escuchá el resultado. ¡Te puede sorprender! 🔥🎵`;

function urlInvitar(telefono: string, codigo: string, plantilla: string): string {
  const mensaje = `${plantilla}\n\nEntrá en https://corridos.online — con tu número y este código de acceso vas directo: ${codigo}`;
  return `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
}

type EstadoFila = { estado: 'idle' } | { estado: 'preparando' } | { estado: 'listo'; codigo: string } | { estado: 'error' };

function FilaTenant({ t, plantilla }: { t: Tenant; plantilla: string }) {
  const [fila, setFila] = useState<EstadoFila>({ estado: 'idle' });

  // Genera un código fresco (mismo mecanismo que "Alta rápida") en vez de
  // reusar uno viejo — si esta persona nunca volvió, lo más probable es
  // que su código original ya haya vencido a los 7 días.
  async function prepararInvitacion() {
    setFila({ estado: 'preparando' });
    try {
      const res = await fetch('/api/admin/alta-rapida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: t.telefono }),
      });
      const data = await res.json();
      if (!res.ok) { setFila({ estado: 'error' }); return; }
      setFila({ estado: 'listo', codigo: data.codigo });
    } catch {
      setFila({ estado: 'error' });
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem' }}>
      <div>
        <div style={{ fontWeight: 600 }}>{t.telefono}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Registrado {formatFecha(t.fechaRegistro)} · hace {diasDesde(t.fechaRegistro)} días sin usar su prueba gratis
        </div>
      </div>
      {fila.estado === 'listo' ? (
        <a
          href={urlInvitar(t.telefono, fila.codigo, plantilla)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          📲 Abrir WhatsApp y enviar
        </a>
      ) : (
        <button className="btn-secondary" disabled={fila.estado === 'preparando'} onClick={prepararInvitacion}>
          {fila.estado === 'preparando' ? '...' : fila.estado === 'error' ? '⚠️ Reintentar' : '✉️ Preparar invitación'}
        </button>
      )}
    </div>
  );
}

export default function ReactivarPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [cargando, setCargando] = useState(true);
  const [diasMinimos, setDiasMinimos] = useState(DIAS_MINIMOS_DEFAULT);
  const [plantilla, setPlantilla] = useState(MENSAJE_INVITACION_DEFAULT);

  const cargar = useCallback(() => {
    return fetch('/api/admin/tenants')
      .then(res => res.json())
      .then(data => setTenants(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => { cargar().finally(() => setCargando(false)); }, [cargar]);

  const sinActivar = useMemo(() => {
    return tenants
      .filter(t => (t.cancionesGratisUsadas ?? 0) === 0 && diasDesde(t.fechaRegistro) >= diasMinimos)
      .sort((a, b) => a.fechaRegistro.localeCompare(b.fechaRegistro));
  }, [tenants, diasMinimos]);

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
          <h2 style={{ margin: '0 0 0.5rem' }}>🎯 Reactivar pruebas gratis sin usar</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
            Tenants que se registraron pero nunca generaron su canción gratis — cada invitación genera un código de acceso fresco (el original puede haber vencido) y abre WhatsApp con el mensaje listo para enviar.
          </p>

          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
            Mostrar quienes llevan más de:
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="number"
              min={0}
              value={diasMinimos}
              onChange={e => setDiasMinimos(Math.max(0, Number(e.target.value) || 0))}
              className="input"
              style={{ width: 80 }}
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>días sin activar</span>
          </div>

          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
            Mensaje (editable — el link y el código de acceso se agregan solos al final)
          </label>
          <textarea
            value={plantilla}
            onChange={e => setPlantilla(e.target.value)}
            rows={7}
            className="input"
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', marginBottom: '1rem' }}
          />
        </section>

        <section className="panel" style={{ padding: '1.25rem' }}>
          <h2 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Sin activar hace {diasMinimos}+ días
            {!cargando && <span className="badge">{sinActivar.length}</span>}
          </h2>
          {cargando ? (
            <p className="loading-msg">Cargando…</p>
          ) : sinActivar.length === 0 ? (
            <p className="empty-msg">Nadie en ese rango — todos usaron su prueba o se registraron hace menos de {diasMinimos} días.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {sinActivar.map(t => (
                <FilaTenant key={t.telefono} t={t} plantilla={plantilla} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
