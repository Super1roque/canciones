'use client';
import { useEffect, useState } from 'react';
import { ADMIN_WHATSAPP } from '@/lib/config';
import { trackMetaPixel } from '@/lib/metaPixel';
import { PRECIO_DESCARGA } from '@/lib/promo';
import { formatoRestante } from '@/lib/tiempo';
import type { CancionPendiente } from '@/lib/cancionCompartidaService';

// Tarjeta arriba de la cuenta del tenant: sus canciones sin la descarga pagada que todavía suenan,
// cada una con su cuenta regresiva hasta que se retira (ver venceEn). Las que vencen se quitan solas.
// `vistaAdmin`: el admin la mira desde /admin/pedidos — sus clics no deben contar en el Píxel.
export default function CancionesPendientes({ canciones, vistaAdmin = false }: { canciones: CancionPendiente[]; vistaAdmin?: boolean }) {
  // null hasta montar: la hora del servidor y la del teléfono no coinciden al segundo.
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    setAhora(Date.now());
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(reloj);
  }, []);

  const vigentes = ahora === null ? canciones : canciones.filter(c => c.vence > ahora);
  if (!vigentes.length) return null;

  return (
    <section style={{
      width: '100%', maxWidth: 640, padding: '1.1rem 1.2rem', borderRadius: 18,
      background: 'linear-gradient(160deg, rgba(154,31,43,0.95), rgba(44,10,16,0.95))',
      border: '2px solid #ffd35c', boxShadow: '0 0 28px rgba(255,211,92,0.35)', color: '#fdf3e0',
      display: 'flex', flexDirection: 'column', gap: '0.8rem',
    }}>
      <div>
        <div style={{ fontSize: '1.15rem', fontWeight: 900 }}>
          ⏳ {vigentes.length === 1 ? 'Tenés una canción esperándote' : `Tenés ${vigentes.length} canciones esperándote`}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#e0b98f', marginTop: '0.2rem' }}>
          Por falta de espacio en nuestro servidor se borran cuando llega a cero. Descargalas antes para no perderlas.
        </div>
      </div>
      {vigentes.map(c => (
        <div key={c.id} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem',
          padding: '0.7rem 0.8rem', borderRadius: 14, background: 'rgba(0,0,0,0.35)',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '16rem' }}>🎵 {c.titulo}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#ffd35c', fontVariantNumeric: 'tabular-nums' }}>
              {ahora === null ? '…' : formatoRestante(c.vence - ahora)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <a href={`/cancion/${c.id}`} style={{
              padding: '0.6rem 1rem', borderRadius: 999, textDecoration: 'none', fontWeight: 800, fontSize: '0.9rem',
              background: 'linear-gradient(180deg, #34c46f, #1f8a4c)', color: '#fdf3e0', boxShadow: '0 3px 0 #0f5c32',
            }}>
              ▶️ Escuchar
            </a>
            <a
              href={`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(`Hola, quiero descargar mi canción "${c.titulo}" (L ${PRECIO_DESCARGA}). https://corridos.online/cancion/${c.id}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => !vistaAdmin && trackMetaPixel('InitiateCheckout', { value: PRECIO_DESCARGA, currency: 'HNL', content_name: 'Descarga de canción (recordatorio en la cuenta)' })}
              style={{
                padding: '0.6rem 1rem', borderRadius: 999, textDecoration: 'none', fontWeight: 800, fontSize: '0.9rem',
                background: 'linear-gradient(180deg, #ffd35c, #f2b705)', color: '#2c0a10', boxShadow: '0 3px 0 #a87d00',
              }}
            >
              📥 Descargar — L {PRECIO_DESCARGA}
            </a>
          </div>
        </div>
      ))}
    </section>
  );
}
