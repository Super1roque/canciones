'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';

type Tenant = {
  telefono: string;
  fechaRegistro: string;
  cancionesGratisUsadas: number;
  cancionesGratisLimite: number;
  ultimaInvitacion?: { fecha: string };
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

// Siempre al final del mensaje (no editable desde la plantilla de arriba)
// — para que nunca se pierda sin querer al ajustar el texto principal.
const NOTA_OPT_OUT = 'Si preferís que no te vuelva a escribir sobre esto, avisame y te saco de la lista sin problema.';

function urlInvitar(telefono: string, codigo: string, plantilla: string): string {
  const mensaje = `${plantilla}\n\nEntrá en https://corridos.online — con tu número y este código de acceso vas directo: ${codigo}\n\n${NOTA_OPT_OUT}`;
  return `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
}

type EstadoFila = { estado: 'idle' } | { estado: 'preparando' } | { estado: 'listo'; codigo: string } | { estado: 'error' };

// Marca la invitación como enviada en el mismo click que abre WhatsApp —
// no bloquea la navegación (no hay preventDefault), es solo un aviso al
// servidor de que esto ya se mandó.
function marcarInvitado(telefono: string) {
  fetch('/api/admin/tenants/invitar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefono }),
  }).catch(() => {});
}

function FilaTenant({ t, plantilla, onInvitado }: { t: Tenant; plantilla: string; onInvitado: (telefono: string) => void }) {
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
        {t.ultimaInvitacion && (
          <div style={{ fontSize: '0.75rem', color: 'var(--warning, #d99a2b)', marginTop: '0.15rem' }}>
            ✉️ Ya invitado — {formatFecha(t.ultimaInvitacion.fecha)} (hace {diasDesde(t.ultimaInvitacion.fecha)} días)
          </div>
        )}
      </div>
      {fila.estado === 'listo' ? (
        <a
          href={urlInvitar(t.telefono, fila.codigo, plantilla)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
          onClick={() => { marcarInvitado(t.telefono); onInvitado(t.telefono); }}
        >
          {t.ultimaInvitacion ? '📲 Volver a invitar' : '📲 Abrir WhatsApp y enviar'}
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
  const [ocultarInvitados, setOcultarInvitados] = useState(false);

  const marcarLocal = useCallback((telefono: string) => {
    setTenants(prev => prev.map(t => t.telefono === telefono ? { ...t, ultimaInvitacion: { fecha: new Date().toISOString() } } : t));
  }, []);

  const cargar = useCallback(() => {
    return fetch('/api/admin/tenants')
      .then(res => res.json())
      .then(data => setTenants(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => { cargar().finally(() => setCargando(false)); }, [cargar]);

  const sinActivar = useMemo(() => {
    return tenants
      .filter(t => (t.cancionesGratisUsadas ?? 0) === 0 && diasDesde(t.fechaRegistro) >= diasMinimos)
      .filter(t => !ocultarInvitados || !t.ultimaInvitacion)
      .sort((a, b) => a.fechaRegistro.localeCompare(b.fechaRegistro));
  }, [tenants, diasMinimos, ocultarInvitados]);

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Sin activar hace {diasMinimos}+ días
              {!cargando && <span className="badge">{sinActivar.length}</span>}
            </h2>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={ocultarInvitados} onChange={e => setOcultarInvitados(e.target.checked)} />
              Ocultar a quienes ya invité
            </label>
          </div>
          {cargando ? (
            <p className="loading-msg">Cargando…</p>
          ) : sinActivar.length === 0 ? (
            <p className="empty-msg">Nadie en ese rango — todos usaron su prueba o se registraron hace menos de {diasMinimos} días.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {sinActivar.map(t => (
                <FilaTenant key={t.telefono} t={t} plantilla={plantilla} onInvitado={marcarLocal} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
