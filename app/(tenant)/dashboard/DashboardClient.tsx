'use client';
import { useState, useEffect, useRef } from 'react';
import styles from '../tenant.module.css';
import type { Tenant } from '@/lib/tenantService';
import type { Pedido } from '@/lib/pedidoService';
import { trackMetaPixel } from '@/lib/metaPixel';

const COSTO_CANCION = 100; // debe coincidir con COSTO_CANCION en lib/pedidoService.ts
const MONTOS = [300, 500, 1000] as const;

// Promo "flash": debe coincidir con CREDITO_POR_MONTO en lib/recargaService.ts
const CREDITO_POR_MONTO: Record<number, number> = { 500: 600, 1000: 1300 };
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

function urlWhatsApp(monto: number, telefono: string) {
  const mensaje = `Hola, ya transferí L ${monto} para recargar mi saldo en Canciones (mi número: ${telefono}).`;
  return `https://wa.me/${DATOS_PAGO.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}

// Mismo patrón que RickyMath: Web Share API si el navegador la soporta
// (la mayoría de móviles), y si no, directo a WhatsApp con la URL pegada
// al texto — la audiencia de acá comparte por ahí de todas formas.
const MENSAJE_COMPARTIR = '¡Hola! 👋 Te comparto Canciones — le contás una historia y en minutos tenés tu propia parodia de corrido, bien especial para ti. ¡La primera te sale gratis!';

// Número de cuenta y nombre en grande, aparte del resto — es lo que la
// persona tiene que copiar bien en su app bancaria, así que no puede quedar
// mezclado con el resto del texto como una línea más.
function DatosDeposito({ monto }: { monto: number }) {
  const [copiado, setCopiado] = useState(false);
  const creditoTotal = credito(monto);
  const bono = creditoTotal - monto;

  function copiarCuenta() {
    navigator.clipboard.writeText(DATOS_PAGO.cuenta).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  return (
    <div style={{
      background: 'var(--cr-surface-2)', border: '2px solid var(--cr-gold)', borderRadius: 14,
      padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem', textAlign: 'left',
    }}>
      <div className={styles.textMuted} style={{ fontSize: '0.82rem', fontWeight: 700 }}>
        🏦 {DATOS_PAGO.banco}
      </div>

      <div>
        <div className={styles.textMuted} style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>
          Número de cuenta
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{
            fontSize: '1.7rem', fontWeight: 800, color: 'var(--cr-gold)', letterSpacing: '0.04em',
            fontFamily: 'monospace', lineHeight: 1.1, wordBreak: 'break-all',
          }}>
            {DATOS_PAGO.cuenta}
          </div>
          <button type="button" onClick={copiarCuenta} className={styles.btnSecondary} style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', minHeight: 'auto' }}>
            {copiado ? '✅' : '📋 Copiar'}
          </button>
        </div>
      </div>

      <div>
        <div className={styles.textMuted} style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>
          A nombre de
        </div>
        <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{DATOS_PAGO.titular}</div>
        <div className={styles.textMuted} style={{ fontSize: '0.8rem', marginTop: '0.15rem' }}>Cédula: {DATOS_PAGO.cedula}</div>
      </div>

      <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>
        Monto a transferir: <span style={{ color: 'var(--cr-gold)' }}>L {monto}</span>
      </div>

      {bono > 0 && (
        <div style={{
          background: 'rgba(31,138,76,0.16)', border: '1.5px solid var(--cr-green)', borderRadius: 10,
          padding: '0.5rem 0.75rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--cr-green-soft)',
        }}>
          🔥 Con esta recarga recibís L {creditoTotal} de saldo (L {bono} de bono gratis)
        </div>
      )}
    </div>
  );
}

async function compartirApp() {
  const url = window.location.origin;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Canciones', text: MENSAJE_COMPARTIR, url });
    } catch {
      // El usuario canceló el selector — no hace falta avisar nada.
    }
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${MENSAJE_COMPARTIR} ${url}`)}`, '_blank');
}

export default function DashboardClient({ tenant: tenantInicial, pedidosIniciales }: { tenant: Tenant; pedidosIniciales: Pedido[] }) {
  const [tenant, setTenant] = useState(tenantInicial);
  const [pedidos, setPedidos] = useState(pedidosIniciales);
  const [recargaPendiente, setRecargaPendiente] = useState<number | null>(null);
  const [montoAConfirmar, setMontoAConfirmar] = useState<number | null>(null);

  const usaGratis = tenant.cancionesGratisUsadas < tenant.cancionesGratisLimite;

  // El evento "Purchase" no se puede disparar desde donde el admin aprueba
  // la recarga (quedaría atribuido a la sesión del admin, no a la del
  // comprador) — mismo problema y misma solución que en RickyMath: se
  // dispara acá, en el navegador del propio tenant, comparando el saldo
  // contra el que tenía antes de este poll. Arranca desde el saldo real
  // con el que se cargó la página, así que no duplica el aviso entre
  // visitas ni sesiones distintas.
  const saldoAnteriorRef = useRef(tenantInicial.saldo ?? 0);

  // Trae saldo y pedidos actualizados en segundo plano — así si el admin
  // aprueba una recarga o marca un pedido como entregado, se refleja acá
  // sin que el tenant tenga que recargar la página a mano. Solo mientras
  // la pestaña está visible, para no gastar batería/datos de fondo.
  useEffect(() => {
    let cancelado = false;

    async function actualizar() {
      if (document.visibilityState !== 'visible') return;
      try {
        const [resPedidos, resTenant] = await Promise.all([
          fetch('/api/pedidos'),
          fetch('/api/tenants/me'),
        ]);
        if (cancelado) return;
        if (resPedidos.ok) setPedidos(await resPedidos.json());
        if (resTenant.ok) {
          const nuevoTenant = await resTenant.json();
          const saldoNuevo = nuevoTenant.saldo ?? 0;
          if (saldoNuevo > saldoAnteriorRef.current) {
            trackMetaPixel('Purchase', { value: saldoNuevo - saldoAnteriorRef.current, currency: 'HNL' });
          }
          saldoAnteriorRef.current = saldoNuevo;
          setTenant(nuevoTenant);
        }
      } catch {
        // Silencioso — se reintenta en el próximo ciclo.
      }
    }

    const intervalo = setInterval(actualizar, 15000);
    document.addEventListener('visibilitychange', actualizar);

    return () => {
      cancelado = true;
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', actualizar);
    };
  }, []);

  // "Continuar" en el modal de advertencia solo pasa a mostrar los datos
  // de depósito.
  function confirmarRecarga() {
    if (!montoAConfirmar) return;
    setRecargaPendiente(montoAConfirmar);
    setMontoAConfirmar(null);
  }

  // Solo abre WhatsApp — no queda nada guardado en el sistema. El
  // comprobante que llega por ese chat es la única confirmación real; el
  // admin acredita el saldo a mano desde /admin/tenants recién después de
  // verlo (antes esto creaba una "recarga pendiente" en Firestore, pero
  // hubo casos de gente que avisaba sin haber pagado, dejando la cola
  // llena de solicitudes falsas que nadie iba a resolver).
  function alAvisarWhatsApp() {
    if (!recargaPendiente) return;
    const monto = recargaPendiente;
    window.open(urlWhatsApp(monto, tenant.telefono), '_blank', 'noopener,noreferrer');
    setRecargaPendiente(null);
    trackMetaPixel('InitiateCheckout', { value: monto, currency: 'HNL' });
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
            <div style={{ position: 'relative' }}>
              {usaGratis && (
                <span style={{
                  position: 'absolute', top: -12, right: -10, zIndex: 1,
                  background: 'var(--cr-green)', color: '#fdf3e0', fontFamily: 'inherit',
                  fontSize: '0.68rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: 999,
                  boxShadow: '0 2px 0 rgba(0,0,0,0.3)', whiteSpace: 'nowrap', transform: 'rotate(-6deg)',
                }}>
                  🔥 1ra gratis
                </span>
              )}
              <a href="/crear-parodia" className={styles.btnPrimary}>🎤 Pedir nueva canción</a>
            </div>
          </div>
          <div className={styles.textMuted} style={{ fontSize: '0.82rem' }}>
            {usaGratis
              ? 'Todavía tenés tu canción gratis disponible.'
              : `Cada canción nueva cuesta L ${COSTO_CANCION}, se descuenta de tu saldo.`}
          </div>
        </div>

        <div className={styles.panel} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 className={styles.heroTitle} style={{ fontSize: '1.1rem', margin: 0 }}>
            Comprar créditos{' '}
            <span className={styles.textMuted} style={{ fontSize: '0.78rem', fontWeight: 400 }}>
              (No se aceptan depósitos menores a 300 Lempiras)
            </span>
          </h2>
          {recargaPendiente ? (
            <div className={styles.formGroup}>
              <p style={{ margin: 0 }}>Transferí a esta cuenta:</p>
              <DatosDeposito monto={recargaPendiente} />
              <button type="button" className={styles.btnPrimary} onClick={alAvisarWhatsApp}>
                💬 Avisar por WhatsApp que ya transferí
              </button>
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
                    <button className={styles.btnPrimary} style={{ width: '100%' }} onClick={() => setMontoAConfirmar(monto)}>
                      + L {monto}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
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
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {p.cancionCompartidaId && (
                      <a
                        href={`/cancion/${p.cancionCompartidaId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.btnSecondary}
                        style={{ textDecoration: 'none', fontSize: '0.82rem', padding: '0.5rem 0.9rem', minHeight: 'auto' }}
                      >
                        🎧 Escuchar
                      </a>
                    )}
                    <span
                      className={styles.badge}
                      style={p.estado === 'entregada' ? { background: 'rgba(31,138,76,0.14)', borderColor: 'var(--cr-green)', color: 'var(--cr-green)' } : undefined}
                    >
                      {p.estado === 'entregada' ? '✅ Entregada' : '⏳ Pendiente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', padding: '0.5rem 0 1rem' }}>
          <button
            onClick={compartirApp}
            className={styles.btnSecondary}
            style={{
              background: 'linear-gradient(180deg, var(--cr-green-soft), var(--cr-green))',
              color: '#fdf3e0', border: 'none', boxShadow: '0 4px 0 #0f5c32',
            }}
          >
            📤 Compartir Canciones
          </button>
        </div>

      </div>

      {montoAConfirmar && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div className={styles.panel} style={{ maxWidth: 420, width: '100%', padding: '1.75rem', textAlign: 'center' }}>
            <span style={{ fontSize: '2.5rem' }}>⚠️</span>
            <h3 className={styles.heroTitle} style={{ fontSize: '1.2rem', margin: '0.75rem 0 1rem' }}>
              Vas a recargar L {montoAConfirmar}
            </h3>
            <p style={{ margin: '0 0 1.25rem', lineHeight: 1.6 }}>
              A continuación vas a ver los datos para hacer el depósito. Una vez que transfieras, avisale al administrador por WhatsApp — ahí es cuando se registra tu pedido. Vas a tener que <strong>comprobarlo con el voucher de la transferencia</strong> — si el comprobante nunca llega, se va a tomar como <strong style={{ color: 'var(--cr-error)' }}>mal uso del sistema</strong>.
            </p>
            <div style={{ marginBottom: '1.25rem' }}>
              <DatosDeposito monto={montoAConfirmar} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <button className={styles.btnPrimary} onClick={confirmarRecarga}>
                ✅ Sí, voy a depositar — Continuar
              </button>
              <button className={styles.btnSecondary} onClick={() => setMontoAConfirmar(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
