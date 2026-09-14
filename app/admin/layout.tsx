'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { esSuperAdmin } from '@/lib/admin';

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const esLogin = pathname === '/admin/login';

  useEffect(() => {
    if (loading || esLogin) return;
    if (!esSuperAdmin(user)) router.replace('/admin/login');
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
