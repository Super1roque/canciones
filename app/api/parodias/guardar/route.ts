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

export async function POST(request: Request) {
  try {
    const { cancion_base, estilo, descripcionEstilo, direccionGenerador, historia, parodia } = await request.json();

    if (!cancion_base || !historia || !parodia) {
      return NextResponse.json({ error: 'Faltan datos para guardar la parodia' }, { status: 400 });
    }

    const creaciones = leerCreaciones();

    const nuevaCreacion = {
      id: Date.now().toString(),
      cancion_base,
      estilo: estilo ?? '',
      descripcionEstilo: descripcionEstilo ?? '',
      direccionGenerador: direccionGenerador ?? '',
      historia,
      parodia,
      fecha: new Date().toISOString(),
    };

    creaciones.push(nuevaCreacion);
    guardarCreaciones(creaciones);

    return NextResponse.json(nuevaCreacion, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error al guardar la parodia' }, { status: 500 });
  }
}
