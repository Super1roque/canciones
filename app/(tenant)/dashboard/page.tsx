import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { obtenerTenant } from '@/lib/tenantService';
import { listarPedidosPorTelefono } from '@/lib/pedidoService';
import DashboardClient from './DashboardClient';

// Server Component — misma resolución de sesión que /crear-parodia: sin
// cookie o tenant inexistente, vuelve a la landing a registrarse.
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const telefono = cookieStore.get('tenant_phone')?.value;

  if (!telefono) redirect('/');

  const tenant = await obtenerTenant(telefono);
  if (!tenant) redirect('/');

  const pedidos = await listarPedidosPorTelefono(telefono);

  return <DashboardClient tenant={tenant} pedidosIniciales={pedidos} />;
}
