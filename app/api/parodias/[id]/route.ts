import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CREACIONES_PATH = path.join(process.cwd(), 'data', 'creaciones.json');

function leerCreaciones() {
  const data = fs.readFileSync(CREACIONES_PATH, 'utf-8');
  return JSON.parse(data);
}

function guardarCreaciones(creaciones: unknown[]) {
  fs.writeFileSync(CREACIONES_PATH, JSON.stringify(creaciones, null, 2), 'utf-8');
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { urlCancion } = await request.json();
    const creaciones = leerCreaciones();
    const index = creaciones.findIndex((c: { id: string }) => c.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Parodia no encontrada' }, { status: 404 });
    }

    creaciones[index] = { ...creaciones[index], urlCancion: urlCancion ?? '' };
    guardarCreaciones(creaciones);

    return NextResponse.json(creaciones[index]);
  } catch {
    return NextResponse.json({ error: 'Error al actualizar la parodia' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const creaciones = leerCreaciones();
    const index = creaciones.findIndex((c: { id: string }) => c.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Parodia no encontrada' }, { status: 404 });
    }

    creaciones.splice(index, 1);
    guardarCreaciones(creaciones);

    return NextResponse.json({ mensaje: 'Parodia eliminada correctamente' });
  } catch {
    return NextResponse.json({ error: 'Error al eliminar la parodia' }, { status: 500 });
  }
}
