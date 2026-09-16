import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { marcarOnboardingVisto } from '@/lib/tenantService';

// Se llama cuando el tenant cierra el video de inducción — para que no
// vuelva a aparecer en su próxima visita.
export async function POST() {
  const cookieStore = await cookies();
  const telefono = cookieStore.get('tenant_phone')?.value;

  if (!telefono) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  await marcarOnboardingVisto(telefono);
  return NextResponse.json({ ok: true });
}
