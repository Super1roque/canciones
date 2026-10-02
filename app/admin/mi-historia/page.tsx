import MiHistoriaApp from '@/components/MiHistoriaApp';
import { CLAVE_ADMIN } from '@/lib/miHistoriaService';

// La herramienta en sí vive en components/MiHistoriaApp.tsx, compartida con
// app/historia/[clave]/page.tsx (la versión que usan los tenants por link,
// sin login) — acá solo se fija la clave del admin.
export default function MiHistoriaPage() {
  return <MiHistoriaApp clave={CLAVE_ADMIN} />;
}
