'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminLogin() {
  const { loginConGoogle } = useAuth();
  const router = useRouter();
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setEntrando(true);
    setError('');
    try {
      await loginConGoogle();
      router.push('/admin');
    } catch {
      setError('No se pudo iniciar sesión. Intentá de nuevo.');
    } finally {
      setEntrando(false);
    }
  }

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🎵</span>
            <span className="logo-text">Canciones</span>
          </div>
        </div>
      </header>

      <main className="main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="panel" style={{ padding: '2.5rem', maxWidth: 360, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.4rem' }}>Panel de admin</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Acceso restringido</p>
          </div>
          <button className="btn-primary" onClick={handleLogin} disabled={entrando} style={{ justifyContent: 'center' }}>
            {entrando ? <span className="btn-spinner">Entrando...</span> : '🔑 Continuar con Google'}
          </button>
          {error && <p style={{ fontSize: '0.82rem', color: 'var(--error)' }}>{error}</p>}
        </div>
      </main>
    </>
  );
}
