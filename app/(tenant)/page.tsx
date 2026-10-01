import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validarSesion } from '@/lib/tenantService';
import LandingClient from './LandingClient';

// Server Component — si ya hay una sesión válida en este navegador, nos
// saltamos el formulario de teléfono y vamos directo al dashboard, en vez
// de hacerle escribir el número de nuevo a alguien que ya está adentro.
export default async function Landing() {
  const cookieStore = await cookies();
  const telefono = cookieStore.get('tenant_phone')?.value;
  const sesionId = cookieStore.get('tenant_session')?.value;

  if (telefono) {
    const tenant = await validarSesion(telefono, sesionId);
    if (tenant) redirect('/dashboard');
  }

  return <LandingClient />;
}
