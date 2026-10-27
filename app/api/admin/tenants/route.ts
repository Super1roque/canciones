import { NextResponse } from 'next/server';
import { listarTodosTenants } from '@/lib/tenantService';
import { listarTodosLosLinks } from '@/lib/historiaLinksService';

export async function GET() {
  const [tenants, links] = await Promise.all([listarTodosTenants(), listarTodosLosLinks()]);
  // Solo el link de su propia historia: los homenajes que haga un tenant
  // comparten su teléfono y pisarían a este en el Map.
  const linkPorTelefono = new Map(links.filter(l => (l.plantilla || 'vida') === 'vida').map(l => [l.telefono, l]));

  // No se manda sesionId tal cual al navegador (es un token interno) — el
  // admin solo necesita saber si hay una sesión activa o no, para decidir
  // si mostrar el botón de liberarla.
  return NextResponse.json(tenants.map(({ sesionId, ...resto }) => {
    const link = linkPorTelefono.get(resto.telefono);
    return {
      ...resto,
      sesionActiva: !!sesionId,
      historiaLink: link ? { url: `https://corridos.online/historia/${link.token}`, nombre: link.nombre, fecha: link.fecha } : null,
    };
  }));
}
