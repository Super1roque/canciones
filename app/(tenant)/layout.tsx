import { Rye } from 'next/font/google';
import styles from './tenant.module.css';

// Fuente festiva tipo cartel para los títulos del tema "corridos" — el
// resto del texto usa la fuente del sistema (Inter, ya cargada en
// app/globals.css, que igual aplica acá porque los imports de CSS de
// Next.js son globales).
const rye = Rye({ weight: '400', subsets: ['latin'], variable: '--font-corrido' });

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${styles.shell} ${rye.variable}`}>
      <header className={styles.header}>
        <span className={styles.logo}>🎸 Canciones</span>
      </header>
      {children}
    </div>
  );
}
