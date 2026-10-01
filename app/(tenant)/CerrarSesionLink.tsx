'use client';

// Deja cambiar de número en este mismo dispositivo — desde que un
// dispositivo solo puede tener un número con sesión activa a la vez (ver
// /api/tenants/entrar), esto es lo que le permite a alguien salir del suyo
// sin tener que pedirle al admin que la libere a mano.
export default function CerrarSesionLink() {
  async function cerrarSesion() {
    await fetch('/api/tenants/salir', { method: 'POST' });
    window.location.href = '/';
  }

  return (
    <button
      type="button"
      onClick={cerrarSesion}
      style={{
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        color: 'var(--cr-text-muted)', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      Cerrar sesión
    </button>
  );
}
