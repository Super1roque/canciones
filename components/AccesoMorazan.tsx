'use client';
import { useEffect, useState } from 'react';

// Pie de /morazan mientras el libro está a la venta: el comprador escribe el correo con el
// que pagó en Hotmart y el libro completo se abre en este navegador. Hotmart lo devuelve a
// /morazan?compra=ok después de pagar; como el aviso de Hotmart (webhook) puede tardar unos
// segundos más que el comprador, en ese caso se reintenta solo durante medio minuto.
export default function AccesoMorazan() {
  const [abierto, setAbierto] = useState(false);
  const [recienCompro, setRecienCompro] = useState(false);
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'' | 'buscando' | 'no' | 'error'>('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('compra') === 'ok') {
      setRecienCompro(true);
      setAbierto(true);
      // Lleva al comprador directo al formulario, sin pasar por todo el capítulo de muestra.
      setTimeout(() => document.getElementById('acceso')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    }
  }, []);

  async function desbloquear(e: React.FormEvent) {
    e.preventDefault();
    setEstado('buscando');
    setMensaje('');
    const intentos = recienCompro ? 8 : 1;
    for (let i = 0; i < intentos; i++) {
      try {
        const r = await fetch('/api/morazan/desbloquear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const datos = await r.json();
        if (datos.ok) {
          window.location.href = '/morazan';
          return;
        }
        if (datos.error) {
          setEstado('error');
          setMensaje(datos.error);
          return;
        }
      } catch {
        setEstado('error');
        setMensaje('No se pudo comprobar. Revisa tu conexión e intenta de nuevo.');
        return;
      }
      if (i < intentos - 1) await new Promise((res) => setTimeout(res, 4000));
    }
    setEstado('no');
  }

  if (!abierto) {
    return (
      <p style={{ marginTop: '1.5rem', fontSize: '0.9rem' }}>
        <button
          onClick={() => setAbierto(true)}
          style={{ background: 'none', border: 0, color: '#6ee7b7', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}
        >
          ¿Ya lo compraste? Ábrelo aquí
        </button>
      </p>
    );
  }

  return (
    <form
      id="acceso"
      onSubmit={desbloquear}
      style={{
        margin: '2rem auto 0',
        maxWidth: 420,
        padding: '1.25rem',
        borderRadius: 16,
        background: 'rgba(16,185,129,0.12)',
        border: '1px solid rgba(110,231,183,0.35)',
        textAlign: 'left',
      }}
    >
      <p style={{ margin: '0 0 0.75rem', color: '#eafff5', fontSize: '0.95rem', lineHeight: 1.5 }}>
        {recienCompro ? (
          <>
            <strong>¡Gracias por tu compra!</strong> Escribe el correo con el que pagaste en Hotmart y el libro
            completo se abre aquí mismo.
          </>
        ) : (
          'Escribe el correo con el que pagaste en Hotmart.'
        )}
      </p>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tucorreo@ejemplo.com"
        autoComplete="email"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '0.75rem 0.9rem',
          borderRadius: 10,
          border: '1px solid rgba(110,231,183,0.4)',
          background: 'rgba(0,0,0,0.25)',
          color: '#eafff5',
          fontSize: '1rem',
        }}
      />
      <button
        type="submit"
        disabled={estado === 'buscando'}
        style={{
          marginTop: '0.75rem',
          width: '100%',
          padding: '0.8rem',
          borderRadius: 999,
          border: 0,
          background: '#6ee7b7',
          color: '#053b2a',
          fontWeight: 800,
          fontSize: '1rem',
          cursor: estado === 'buscando' ? 'wait' : 'pointer',
        }}
      >
        {estado === 'buscando' ? (recienCompro ? 'Confirmando tu pago…' : 'Buscando tu compra…') : 'Abrir el libro completo'}
      </button>
      {estado === 'no' && (
        <p style={{ margin: '0.75rem 0 0', color: '#fde68a', fontSize: '0.85rem', lineHeight: 1.5 }}>
          No encontramos una compra con ese correo. Revisa que sea el mismo que usaste en Hotmart. Si acabas de pagar,
          espera un minuto e intenta otra vez.
        </p>
      )}
      {estado === 'error' && (
        <p style={{ margin: '0.75rem 0 0', color: '#fca5a5', fontSize: '0.85rem' }}>{mensaje}</p>
      )}
    </form>
  );
}
