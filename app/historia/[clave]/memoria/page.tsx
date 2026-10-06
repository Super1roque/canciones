import MemoriaApp from '@/components/MemoriaApp';

// Página de lectura para la familia — mismo "clave" que /historia/[clave]
// (el link de siempre), pero sin ninguno de los controles de edición.
// Pensada para compartir aparte: navegación por capítulos, galería de
// fotos, y la voz real (o una lectura sintética) de cada respuesta.
export default async function MemoriaPage({ params }: { params: Promise<{ clave: string }> }) {
  const { clave } = await params;
  return <MemoriaApp clave={clave} />;
}
