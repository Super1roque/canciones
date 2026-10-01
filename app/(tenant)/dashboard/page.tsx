import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validarSesion } from '@/lib/tenantService';
import { listarPedidosPorTelefono } from '@/lib/pedidoService';
import DashboardClient from './DashboardClient';

// Server Component — misma resolución de sesión que /crear-parodia: sin
// cookie o sesión inválida, vuelve a la landing a entrar de nuevo.
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const telefono = cookieStore.get('tenant_phone')?.value;

  if (!telefono) redirect('/');

  const tenant = await validarSesion(telefono, cookieStore.get('tenant_session')?.value);
  if (!tenant) redirect('/');

  // Un tenant que todavía no usó su canción gratis se salta el dashboard
  // (con saldo y "Comprar créditos", que asusta a quien recién llega sin
  // haber probado la app todavía) y va directo a pedir su primera
  // canción. Una vez que ya la usó, el dashboard vuelve a mostrarse
  // normal — esto solo aplica antes de esa primera vez.
  const usaGratis = tenant.cancionesGratisUsadas < tenant.cancionesGratisLimite;
  if (usaGratis) redirect('/crear-parodia');

  const pedidos = await listarPedidosPorTelefono(telefono);

  return <DashboardClient tenant={tenant} pedidosIniciales={pedidos} />;
}
