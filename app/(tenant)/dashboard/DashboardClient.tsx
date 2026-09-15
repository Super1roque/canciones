'use client';
import { useState } from 'react';
import styles from '../tenant.module.css';
import type { Tenant } from '@/lib/tenantService';
import type { Pedido } from '@/lib/pedidoService';

const COSTO_CANCION = 100; // debe coincidir con COSTO_CANCION en lib/pedidoService.ts
const MONTOS = [500, 1000] as const;

// Promo "flash": debe coincidir con CREDITO_POR_MONTO en lib/recargaService.ts
const CREDITO_POR_MONTO: Record<number, number> = { 500: 500, 1000: 1200 };
function credito(monto: number) {
  return CREDITO_POR_MONTO[monto] ?? monto;
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// El teléfono se guarda como solo dígitos (ver normalizarTelefono en
// lib/tenantService.ts) — esto lo muestra legible, con +504 y guion si
// tiene el formato esperado de Honduras; si no, lo muestra tal cual.
function formatTelefono(digits: string) {
  if (digits.startsWith('504') && digits.length === 11) {
    const local = digits.slice(3);
    return `+504 ${local.slice(0, 4)}-${local.slice(4)}`;
  }
  return `+${digits}`;
}

const DATOS_PAGO = {
  banco: 'Banco Atlántida',
  cuenta: '14720926485',
  titular: 'Armando Roque Godoy',
  cedula: '0801-1963-05344',
  whatsapp: '50496895978',
};

function instruccionesPago(monto: number) {
  const creditoTotal = credito(monto);
  const bono = creditoTotal - monto;
  const lineaBono = bono > 0 ? `\n\n🔥 Con esta recarga recibís L ${creditoTotal} de saldo (L ${bono} de bono gratis).` : '';
  return `Transferí L ${monto} a:\n\n${DATOS_PAGO.banco}\nCuenta: ${DATOS_PAGO.cuenta}\nA nombre de: ${DATOS_PAGO.titular}\nCédula: ${DATOS_PAGO.cedula}${lineaBono}`;
}

function urlWhatsApp(monto: number, telefono: string) {
  const mensaje = `Hola, ya transferí L ${monto} para recargar mi saldo en Canciones (mi número: ${telefono}).`;
  return `https://wa.me/${DATOS_PAGO.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}

export default function DashboardClient({ tenant, pedidosIniciales }: { tenant: Tenant; pedidosIniciales: Pedido[] }) {
  const [pedidos] = useState(pedidosIniciales);
  const [solicitando, setSolicitando] = useState<number | null>(null);
  const [recargaPendiente, setRecargaPendiente] = useState<number | null>(null);
  const [error, setError] = useState('');

  const usaGratis = tenant.cancionesGratisUsadas < tenant.cancionesGratisLimite;

  async function pedirRecarga(monto: number) {
    setSolicitando(monto);
    setError('');
    try {
      const res = await fetch('/api/recargas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'No se pudo enviar la solicitud'); return; }
      setRecargaPendiente(monto);
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setSolicitando(null);
    }
  }

  return (
    <main className={styles.main} style={{ alignItems: 'flex-start', paddingTop: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', maxWidth: 640 }}>

        <div className={styles.panel} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div className={styles.textMuted} style={{ fontSize: '0.8rem' }}>📱 Conectado como {formatTelefono(tenant.telefono)}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div className={styles.textMuted} style={{ fontSize: '0.8rem' }}>Tu saldo</div>
              <div className={styles.heroTitle} style={{ fontSize: '2rem', margin: 0 }}>L {tenant.saldo ?? 0}</div>
            </div>
            <a href="/crear-parodia" className={styles.btnPrimary}>🎤 Pedir nueva canción</a>
          </div>
          <div className={styles.textMuted} style={{ fontSize: '0.82rem' }}>
            {usaGratis
              ? 'Todavía tenés tu canción gratis disponible.'
              : `Cada canción nueva cuesta L ${COSTO_CANCION}, se descuenta de tu saldo.`}
          </div>
        </div>

        <div className={styles.panel} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 className={styles.heroTitle} style={{ fontSize: '1.1rem', margin: 0 }}>Comprar créditos</h2>
          {recargaPendiente ? (
            <div className={styles.formGroup}>
              <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{instruccionesPago(recargaPendiente)}</p>
              <a
                href={urlWhatsApp(recargaPendiente, tenant.telefono)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnPrimary}
                style={{ textDecoration: 'none' }}
              >
                💬 Avisar por WhatsApp que ya transferí
              </a>
              <button className={styles.btnSecondary} onClick={() => setRecargaPendiente(null)}>Listo</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {MONTOS.map(monto => {
                const bono = credito(monto) - monto;
                return (
                  <div key={monto} style={{ position: 'relative', flex: '1 1 auto', minWidth: 140, maxWidth: 220 }}>
                    {bono > 0 && (
                      <span style={{
                        position: 'absolute', top: -12, right: -10, zIndex: 1,
                        background: 'var(--cr-green)', color: '#fdf3e0', fontFamily: 'inherit',
                        fontSize: '0.68rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: 999,
                        boxShadow: '0 2px 0 rgba(0,0,0,0.3)', whiteSpace: 'nowrap', transform: 'rotate(-6deg)',
                      }}>
                        🔥 +L{bono} gratis
                      </span>
                    )}
                    <button className={styles.btnPrimary} style={{ width: '100%' }} onClick={() => pedirRecarga(monto)} disabled={solicitando === monto}>
                      {solicitando === monto ? 'Enviando...' : `+ L ${monto}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.panel} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2 className={styles.heroTitle} style={{ fontSize: '1.1rem', margin: 0 }}>Tus canciones pedidas</h2>
          {pedidos.length === 0 ? (
            <p className={styles.textMuted}>Todavía no pediste ninguna canción.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {pedidos.map(p => (
                <div key={p.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
                  background: 'var(--cr-surface-2)', border: '2px solid var(--cr-border)', borderRadius: 10, padding: '0.75rem 1rem',
                }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.cancion_base}</div>
                    <div className={styles.textMuted} style={{ fontSize: '0.78rem' }}>{formatFecha(p.fecha)}</div>
                  </div>
                  <span
                    className={styles.badge}
                    style={p.estado === 'entregada' ? { background: 'rgba(31,138,76,0.14)', borderColor: 'var(--cr-green)', color: 'var(--cr-green)' } : undefined}
                  >
                    {p.estado === 'entregada' ? '✅ Entregada' : '⏳ Pendiente'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
