import MiHistoriaApp from '@/components/MiHistoriaApp';

// Página pública — sin login, sin cookie de tenant, sin AdminGuard. El
// único "candado" es que el token (clave) sea largo y random (ver
// lib/historiaLinksService.ts), así que solo quien tenga el link puede
// entrar. No valida contra historia_links a propósito: si alguien entra
// con una clave que nunca se emitió, simplemente arranca una historia
// vacía — mismo criterio permisivo que obtenerOCrearTenant en el resto
// de la app, no hay nada que perder por dejarlo así de simple.
export default async function HistoriaPorLinkPage({ params }: { params: Promise<{ clave: string }> }) {
  const { clave } = await params;
  return <MiHistoriaApp clave={clave} />;
}
