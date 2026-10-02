import { NextResponse } from 'next/server';
import { normalizarTelefono, conCodigoPais, telefonoValido, esCelularHondurasValido } from '@/lib/tenantService';
import { obtenerOCrearLinkHistoria } from '@/lib/historiaLinksService';

// Genera (o reusa, si ya existía) el link de "Mi Historia" para un tenant
// puntual — se lo pasa el admin a mano, no aparece en el dashboard normal.
export async function POST(request: Request) {
  try {
    const { telefono: rawTelefono, nombre: rawNombre } = await request.json();
    const telefono = normalizarTelefono(conCodigoPais(rawTelefono || ''));
    const nombre = (rawNombre || '').trim();

    if (!nombre) {
      return NextResponse.json({ error: 'Falta el nombre de la persona' }, { status: 400 });
    }
    if (!telefonoValido(telefono)) {
      return NextResponse.json({ error: 'Ese número no parece válido' }, { status: 400 });
    }
    if (!esCelularHondurasValido(telefono)) {
      return NextResponse.json({ error: 'Ese no parece un celular de Honduras válido — revisá que tenga 8 dígitos y empiece con 3, 8 o 9' }, { status: 400 });
    }

    const link = await obtenerOCrearLinkHistoria(telefono, nombre);
    return NextResponse.json({ telefono, nombre: link.nombre, url: `https://corridos.online/historia/${link.token}` });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('historia-links:', msg);
    return NextResponse.json({ error: 'Error al generar el link' }, { status: 500 });
  }
}
