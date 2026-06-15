import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Cue = { start: number; end: number; text: string };

export async function POST(req: NextRequest) {
  try {
    const { cues } = await req.json() as { cues: Cue[] };
    if (!cues || !Array.isArray(cues) || cues.length === 0) {
      return NextResponse.json({ error: 'Se requieren los cues' }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada en .env' }, { status: 500 });
    }

    // Agrupar palabras en frases por pausas naturales (gap > 0.8s o 10+ palabras)
    // Esto preserva la estructura real de la letra mejor que los buckets de tiempo fijo
    type Line = { start: number; end: number; text: string };
    const lines: Line[] = [];
    let cur: Line | null = null;
    for (const cue of cues) {
      if (!cur) {
        cur = { start: cue.start, end: cue.end, text: cue.text };
      } else {
        const gap       = cue.start - cur.end;
        const wordCount = cur.text.split(/\s+/).length;
        if (gap > 0.8 || wordCount >= 10) {
          lines.push(cur);
          cur = { start: cue.start, end: cue.end, text: cue.text };
        } else {
          cur.end   = cue.end;
          cur.text += ' ' + cue.text;
        }
      }
    }
    if (cur) lines.push(cur);

    // Limitar a 150 líneas para no exceder tokens
    const step   = lines.length > 150 ? Math.ceil(lines.length / 150) : 1;
    const sample = lines.filter((_, i) => i % step === 0);

    const fmtSec = (s: number) => s.toFixed(2);
    const lyricsBlock = sample.map(l => `[${fmtSec(l.start)}] ${l.text}`).join('\n');
    const lastEnd     = cues[cues.length - 1].end;

    // Lista de timestamps válidos para el snap (inicios de línea, no palabras individuales)
    const lineStarts = lines.map(l => l.start);

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Analiza esta letra con marcas de tiempo y detecta las secciones musicales.
Identifica las secciones basándote en la repetición de frases (el coro se repite) y en la estructura típica de canciones.

LETRA (formato [segundos] texto, cada línea es una frase completa):
${lyricsBlock}

Duración total: ${lastEnd.toFixed(2)}s

REGLAS CRÍTICAS:
1. Cada límite de sección DEBE coincidir EXACTAMENTE con el inicio de una línea de la letra (los timestamps entre corchetes).
2. Nunca cortes una sección en medio de un verso — cada sección debe contener versos completos y con sentido.
3. El startTime de la primera sección DEBE ser ${fmtSec(sample[0].start)}.
4. El endTime de la última sección DEBE ser ${lastEnd.toFixed(2)}.
5. Sin gaps entre secciones (endTime de una = startTime de la siguiente).

Responde SOLO con un array JSON (sin markdown):
[
  { "type": "intro", "label": "Intro", "startTime": ${fmtSec(sample[0].start)}, "endTime": X.XX },
  { "type": "verse", "label": "Verso 1", "startTime": X.XX, "endTime": X.XX },
  ...
]

Tipos: "intro", "verse", "pre-chorus", "chorus", "bridge", "outro", "interlude", "other"
Labels en español (Intro, Verso 1, Pre-Coro, Coro, Coro 2, Puente, Outro…)`,
      }],
    });

    const text      = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'La IA no devolvió JSON válido' }, { status: 500 });
    }

    const rawSections = JSON.parse(jsonMatch[0]) as { type: string; label: string; startTime: number; endTime: number }[];

    // Snap al inicio de línea más cercano (no a palabra individual)
    const snapNearest = (t: number): number => {
      let best = lineStarts[0], bestDiff = Math.abs(t - best);
      for (const ls of lineStarts) {
        const d = Math.abs(ls - t);
        if (d < bestDiff) { bestDiff = d; best = ls; }
      }
      return best;
    };

    const sections = rawSections.map((s, i) => ({
      type:      s.type,
      label:     s.label,
      startTime: i === 0 ? 0 : snapNearest(s.startTime),
      endTime:   0, // se fija abajo
    }));

    // Encadenar: endTime de cada sección = startTime de la siguiente
    for (let i = 0; i < sections.length - 1; i++) {
      sections[i].endTime = sections[i + 1].startTime;
    }
    sections[sections.length - 1].endTime = cues[cues.length - 1].end + 0.001;

    return NextResponse.json({ sections });

  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error desconocido' }, { status: 500 });
  }
}
