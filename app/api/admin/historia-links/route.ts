import { NextResponse } from 'next/server';
import { normalizarTelefono, conCodigoPais, telefonoValido, esCelularHondurasValido } from '@/lib/tenantService';
import { obtenerOCrearLinkHistoria, listarTodosLosLinks } from '@/lib/historiaLinksService';
import { esPlantilla } from '@/lib/plantillasHistoria';

// Lista todas las historias generadas hasta ahora — no todas corresponden
// a un tenant registrado en la app de corridos (ej. familiares que solo
// usan Mi Historia), así que esto NO se cruza contra la tabla de tenants.
export async function GET() {
  const links = await listarTodosLosLinks();
  return NextResponse.json(
    links
      .map(l => ({ telefono: l.telefono, nombre: l.nombre, fecha: l.fecha, plantilla: l.plantilla || 'vida', homenajeado: l.homenajeado || '', url: `https://corridos.online/historia/${l.token}` }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  );
}

// Genera (o reusa, si ya existía) el link de "Mi Historia" para un tenant
// puntual — se lo pasa el admin a mano, no aparece en el dashboard normal.
export async function POST(request: Request) {
  try {
    const { telefono: rawTelefono, nombre: rawNombre, plantilla: rawPlantilla, homenajeado: rawHomenajeado } = await request.json();
    const telefono = normalizarTelefono(conCodigoPais(rawTelefono || ''));
    const nombre = (rawNombre || '').trim();
    const plantilla = esPlantilla(rawPlantilla) ? rawPlantilla : 'vida';
    const homenajeado = (rawHomenajeado || '').trim();

    if (!nombre) {
      return NextResponse.json({ error: 'Falta el nombre de la persona' }, { status: 400 });
    }
    if (plantilla === 'homenaje' && !homenajeado) {
      return NextResponse.json({ error: 'Falta el nombre de la persona a la que se le hace el homenaje' }, { status: 400 });
    }
    if (!telefonoValido(telefono)) {
      return NextResponse.json({ error: 'Ese número no parece válido' }, { status: 400 });
    }
    if (!esCelularHondurasValido(telefono)) {
      return NextResponse.json({ error: 'Ese no parece un celular de Honduras válido — revisá que tenga 8 dígitos y empiece con 3, 8 o 9' }, { status: 400 });
    }

    const link = await obtenerOCrearLinkHistoria(telefono, nombre, plantilla, homenajeado);
    return NextResponse.json({ telefono, nombre: link.nombre, plantilla, homenajeado: link.homenajeado || '', url: `https://corridos.online/historia/${link.token}` });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('historia-links:', msg);
    return NextResponse.json({ error: 'Error al generar el link' }, { status: 500 });
  }
}
