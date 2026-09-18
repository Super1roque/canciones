import { NextResponse } from 'next/server';
import { normalizarTelefono, conCodigoPais, obtenerTenant } from '@/lib/tenantService';
import { obtenerCodigoVigente } from '@/lib/verificacionService';

// Chequeo liviano para la landing: antes de mandar a alguien a repetir todo
// el trámite de WhatsApp, se fija si ese número ya es tenant y todavía
// tiene un código de acceso vigente — si es así, la UI le sugiere usar ese
// atajo en vez de la verificación completa.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get('telefono') || '';
  const telefono = normalizarTelefono(conCodigoPais(raw));

  const tenant = await obtenerTenant(telefono);
  if (!tenant) return NextResponse.json({ tieneCodigo: false });

  const codigo = await obtenerCodigoVigente(telefono);
  return NextResponse.json({ tieneCodigo: !!codigo });
}
