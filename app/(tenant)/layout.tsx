import { cookies } from 'next/headers';
import { rye } from '@/lib/fuentes';
import styles from './tenant.module.css';
import SoporteLink from './SoporteLink';
import CerrarSesionLink from './CerrarSesionLink';

// Fuente festiva tipo cartel (rye, de lib/fuentes) para los títulos del tema "corridos" — el
// resto del texto usa la fuente del sistema (Inter, ya cargada en
// app/globals.css, que igual aplica acá porque los imports de CSS de
// Next.js son globales).

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const registrado = Boolean(cookieStore.get('tenant_phone')?.value);

  return (
    <div className={`${styles.shell} ${rye.variable}`}>
      <header className={styles.header}>
        <span className={styles.logo}>🎸 Canciones</span>
        {registrado && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <SoporteLink />
            <a
              href="/dashboard"
              style={{
                color: 'var(--cr-gold)', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              💳 Mi cuenta
            </a>
            <CerrarSesionLink />
          </div>
        )}
      </header>
      {children}
    </div>
  );
}
