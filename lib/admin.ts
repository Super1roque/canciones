import type { User } from 'firebase/auth';

// Único email autorizado a entrar al panel de admin — no hay roles ni
// multi-usuario acá, es literalmente vos.
const SUPERADMIN_EMAIL = 'super1roque@gmail.com';

export function esSuperAdmin(user: User | null | undefined): boolean {
  return user?.email === SUPERADMIN_EMAIL;
}
