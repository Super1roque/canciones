import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { obtenerTenant } from '@/lib/tenantService';
import LandingClient from './LandingClient';

// Server Component — si ya hay cookie de sesión válida (número ya
// verificado antes en este navegador), nos saltamos el formulario de
// teléfono/SMS y vamos directo al dashboard, en vez de hacerle repetir la
// verificación a alguien que ya está registrado.
export default async function Landing() {
  const cookieStore = await cookies();
  const telefono = cookieStore.get('tenant_phone')?.value;

  if (telefono) {
    const tenant = await obtenerTenant(telefono);
    if (tenant) redirect('/dashboard');
  }

  return <LandingClient />;
}
