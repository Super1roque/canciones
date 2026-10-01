import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validarSesion } from '@/lib/tenantService';
import CrearParodiaClient from './CrearParodiaClient';

// Server Component — resuelve la sesión del tenant server-side (lectura de
// Firestore directa, sin pasar por HTTP) antes de mostrar nada. Sin cookie,
// tenant inexistente, o sesión inválida (ej. el admin la liberó y alguien
// más entró desde otro aparato), vuelve a la landing a entrar de nuevo.
export default async function CrearParodiaPage() {
  const cookieStore = await cookies();
  const telefono = cookieStore.get('tenant_phone')?.value;

  if (!telefono) redirect('/');

  const tenant = await validarSesion(telefono, cookieStore.get('tenant_session')?.value);
  if (!tenant) redirect('/');

  return <CrearParodiaClient tenant={tenant} />;
}
