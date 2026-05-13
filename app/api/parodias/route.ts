import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CREACIONES_PATH = path.join(process.cwd(), 'data', 'creaciones.json');

function leerCreaciones() {
  const data = fs.readFileSync(CREACIONES_PATH, 'utf-8');
  return JSON.parse(data);
}

export async function GET() {
  try {
    const creaciones = leerCreaciones();
    return NextResponse.json(creaciones.reverse());
  } catch {
    return NextResponse.json({ error: 'Error al leer las creaciones' }, { status: 500 });
  }
}
