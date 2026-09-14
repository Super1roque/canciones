import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { obtenerTenant } from '@/lib/tenantService';
import CrearParodiaClient from './CrearParodiaClient';

// Server Component — resuelve la sesión del tenant server-side (lectura de
// Firestore directa, sin pasar por HTTP) antes de mostrar nada. Sin cookie
// o tenant inexistente, vuelve a la landing a registrarse.
export default async function CrearParodiaPage() {
  const cookieStore = await cookies();
  const telefono = cookieStore.get('tenant_phone')?.value;

  if (!telefono) redirect('/');

  const tenant = await obtenerTenant(telefono);
  if (!tenant) redirect('/');

  return <CrearParodiaClient tenant={tenant} />;
}
