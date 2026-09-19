'use client';
import { useEffect } from 'react';

// El redirect es client-side a propósito: si fuera un redirect HTTP del
// servidor, el rastreador de WhatsApp lo seguiría y terminaría leyendo los
// meta tags del destino final (con su descripción) en vez de los de esta
// página minimalista. Los rastreadores no ejecutan JS, así que nunca ven
// este redirect — solo lo ven las personas reales.
export default function IrRedirectClient() {
  useEffect(() => {
    window.location.replace('/');
  }, []);

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#5c0f18', color: '#fdf3e0', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '1.5rem',
    }}>
      <div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Abriendo corridos.online…</p>
        <a href="/" style={{ color: '#f2b705', fontWeight: 700 }}>Tocá acá si no pasa nada</a>
      </div>
    </main>
  );
}
