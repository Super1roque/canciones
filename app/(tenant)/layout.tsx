import { cookies } from 'next/headers';
import { Rye } from 'next/font/google';
import styles from './tenant.module.css';

// Fuente festiva tipo cartel para los títulos del tema "corridos" — el
// resto del texto usa la fuente del sistema (Inter, ya cargada en
// app/globals.css, que igual aplica acá porque los imports de CSS de
// Next.js son globales).
const rye = Rye({ weight: '400', subsets: ['latin'], variable: '--font-corrido' });

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const registrado = Boolean(cookieStore.get('tenant_phone')?.value);

  return (
    <div className={`${styles.shell} ${rye.variable}`}>
      <header className={styles.header}>
        <span className={styles.logo}>🎸 Canciones</span>
        {registrado && (
          <a
            href="/dashboard"
            style={{
              color: 'var(--cr-gold)', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            💳 Mi cuenta
          </a>
        )}
      </header>
      {children}
    </div>
  );
}
