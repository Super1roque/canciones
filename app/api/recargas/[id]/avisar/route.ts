import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { obtenerRecarga } from '@/lib/recargaService';
import { avisarNuevaRecarga } from '@/lib/emailService';

// Se llama recién cuando el tenant toca "Avisar por WhatsApp que ya
// transferí" en el dashboard — no al crear la solicitud de recarga, para
// no generar avisos falsos de gente que solo entra a mirar cómo funciona
// sin llegar a pagar ni avisar nada por WhatsApp.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const telefono = cookieStore.get('tenant_phone')?.value;
    if (!telefono) {
      return NextResponse.json({ error: 'Necesitás registrarte con tu número de teléfono' }, { status: 401 });
    }

    const { id } = await params;
    const recarga = await obtenerRecarga(id);
    if (!recarga || recarga.telefono !== telefono) {
      return NextResponse.json({ error: 'Recarga no encontrada' }, { status: 404 });
    }

    void avisarNuevaRecarga(recarga.telefono, recarga.monto);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('avisar recarga:', msg);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
