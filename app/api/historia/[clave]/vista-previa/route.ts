import { NextResponse } from 'next/server';
import { obtenerHistoria } from '@/lib/miHistoriaService';
import { construirMaterialRespondido } from '@/lib/etapasHistoria';
import { generarVistaPreviaHistoria } from '@/lib/claudeService';

export const runtime = 'nodejs';

// Vista previa en vivo, con IA, de lo que el tenant lleva respondido —
// pensada para mostrarse durante la propia entrevista (ver botón "✨ Ver un
// adelanto de tu historia" en StageEndScreen), no después de exportar. Sin
// chequeo de sesión, mismo criterio que el resto de /api/historia/[clave]/*.
export async function POST(_request: Request, { params }: { params: Promise<{ clave: string }> }) {
  try {
    const { clave } = await params;
    const historia = await obtenerHistoria(clave);
    const material = construirMaterialRespondido(historia);

    if (material.length < 40) {
      return NextResponse.json({ error: 'Respondé al menos una etapa completa para ver un adelanto' }, { status: 400 });
    }

    const texto = await generarVistaPreviaHistoria(material);
    return NextResponse.json({ texto });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('vista-previa historia:', msg);
    return NextResponse.json({ error: 'No se pudo generar el adelanto, intentá de nuevo' }, { status: 500 });
  }
}
