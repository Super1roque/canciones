import { NextResponse } from 'next/server';
import { obtenerHistoria } from '@/lib/miHistoriaService';
import { construirMaterialEtapa, ETAPAS } from '@/lib/etapasHistoria';
import { generarPromptFotoEtapa } from '@/lib/claudeService';

export const runtime = 'nodejs';

// Prompt de imagen (para pegar en Midjourney/DALL·E/etc.) para una etapa
// puntual — pensado para el módulo de Fotos, cuando no hay foto real de ese
// momento y se quiere generar una ilustrativa para subir después. Sin
// chequeo de sesión, mismo criterio que el resto de /api/historia/[clave]/*.
export async function POST(request: Request, { params }: { params: Promise<{ clave: string }> }) {
  try {
    const { clave } = await params;
    const { etapaIndex } = (await request.json()) as { etapaIndex: number };

    if (typeof etapaIndex !== 'number' || !ETAPAS[etapaIndex]) {
      return NextResponse.json({ error: 'Etapa inválida' }, { status: 400 });
    }

    const historia = await obtenerHistoria(clave);
    const material = construirMaterialEtapa(historia, etapaIndex);

    if (!material) {
      return NextResponse.json({
        insuficiente: true,
        mensaje: 'Todavía no hay respuestas en esa etapa — respondé algunas preguntas primero.',
      });
    }

    const prompt = await generarPromptFotoEtapa(ETAPAS[etapaIndex].titulo, material);
    return NextResponse.json({ prompt });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('prompt-foto historia:', msg);
    return NextResponse.json({ error: 'No se pudo generar el prompt, intentá de nuevo' }, { status: 500 });
  }
}
