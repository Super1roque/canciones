import { NextResponse } from 'next/server';
import { obtenerHistoria } from '@/lib/miHistoriaService';
import { construirMaterialRespondido, contarPreguntasRespondidas } from '@/lib/etapasHistoria';
import { generarVistaPreviaHistoria } from '@/lib/claudeService';

export const runtime = 'nodejs';

// Mínimo de preguntas respondidas antes de gastar una llamada a la IA —
// con menos que esto, el adelanto no tendría con qué trabajar, así que en
// vez de forzarlo se le avisa al tenant que todavía es poco lo escrito.
const MINIMO_PREGUNTAS = 3;

// Vista previa en vivo, con IA, de lo que el tenant lleva respondido —
// pensada para mostrarse en cualquier momento de la entrevista (ver botón
// "✨ Ver un adelanto de tu historia" en InterviewScreen), no después de
// exportar. Sin chequeo de sesión, mismo criterio que el resto de
// /api/historia/[clave]/*.
export async function POST(_request: Request, { params }: { params: Promise<{ clave: string }> }) {
  try {
    const { clave } = await params;
    const historia = await obtenerHistoria(clave);

    if (contarPreguntasRespondidas(historia) < MINIMO_PREGUNTAS) {
      return NextResponse.json({
        insuficiente: true,
        mensaje: 'Todavía es poco lo que contaste — respondé un par de preguntas más y volvé a intentar.',
      });
    }

    const material = construirMaterialRespondido(historia);
    const texto = await generarVistaPreviaHistoria(material);
    return NextResponse.json({ texto });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('vista-previa historia:', msg);
    return NextResponse.json({ error: 'No se pudo generar el adelanto, intentá de nuevo' }, { status: 500 });
  }
}
