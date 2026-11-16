import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import admin from 'firebase-admin';
import { getDb } from '@/lib/firebaseService';
import { esNavegadorAdmin } from '@/lib/adminServidor';
import { CODIGO_VALIDO } from '@/lib/pagoDescarga';

export const runtime = 'nodejs';

const CANALES = { fb: 'compartidasFb', wa: 'compartidasWa', otro: 'compartidasOtro' } as const;

// Alguien tocó un botón de compartir con su link personal (?c=<código>). Se cuenta por canal para el panel y se
// guarda la huella del teléfono que compartió, para que sus propias visitas a ese link no cuenten (ver /visita).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (esNavegadorAdmin(request)) return NextResponse.json({ ok: true });
  const { c, canal } = await request.json().catch(() => ({}));
  if (!CODIGO_VALIDO.test(String(c ?? ''))) return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 });
  const campo = CANALES[canal as keyof typeof CANALES] ?? CANALES.otro;

  const ref = getDb().collection('canciones_compartidas').doc(id);
  if (!(await ref.get()).exists) return NextResponse.json({ error: 'Link no válido' }, { status: 404 });
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '';
  const huella = createHash('sha256').update(`${id}|${ip}|${request.headers.get('user-agent') ?? ''}`).digest('hex').slice(0, 40);
  await Promise.all([
    ref.update({ [campo]: admin.firestore.FieldValue.increment(1) }),
    ref.collection('compartidores').doc(String(c)).set({ huella, fecha: new Date().toISOString() }, { merge: true }),
  ]);
  return NextResponse.json({ ok: true });
}
