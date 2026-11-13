'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { esSuperAdmin } from '@/lib/admin';
import { auth } from '@/lib/firebaseClient';

// Las rutas de /api/admin verifican la sesión en el servidor: toda llamada desde el panel lleva el token.
// Va aquí, al cargar el archivo, para que ya esté listo cuando las páginas hagan su primer fetch.
if (typeof window !== 'undefined') {
  const original = window.fetch.bind(window);
  window.fetch = async (entrada, init) => {
    const texto = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const url = new URL(texto, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/admin/')) return original(entrada, init);
    const headers = new Headers(init?.headers ?? (entrada instanceof Request ? entrada.headers : undefined));
    const token = await auth.currentUser?.getIdToken();
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    return original(entrada, { ...init, headers });
  };
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const esLogin = pathname === '/admin/login';

  useEffect(() => {
    if (loading || esLogin) return;
    if (!esSuperAdmin(user)) router.replace('/admin/login');
    // Marca este navegador como del admin: al revisar una canción, su escucha no cuenta como la
    // primera escucha limpia del cliente (ver AudioGreetingClient).
    else {
      try { localStorage.setItem('corridos-admin', '1'); } catch { /* sin almacenamiento */ }
      // Y en el servidor: así sus escuchas tampoco suman al contador de reproducciones del panel.
      fetch('/api/admin/marcar-navegador', { method: 'POST' }).catch(() => {});
    }
  }, [loading, user, esLogin, router]);

  // La página de login siempre se muestra tal cual, sin esperar el estado
  // de auth — es a donde termina todo el mundo que no está autorizado.
  if (esLogin) return <>{children}</>;

  if (loading || !esSuperAdmin(user)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cargando…</span>
      </div>
    );
  }

  return <>{children}</>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminGuard>{children}</AdminGuard>
    </AuthProvider>
  );
}
