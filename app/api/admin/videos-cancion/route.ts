import { NextResponse } from 'next/server';
import { esAdminPeticion } from '@/lib/adminServidor';
import { ESTADOS, cambiarEstado, listarSolicitudes } from '@/lib/videoCancion';

export async function GET(request: Request) {
  if (!(await esAdminPeticion(request))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  return NextResponse.json(await listarSolicitudes());
}

export async function PATCH(request: Request) {
  if (!(await esAdminPeticion(request))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id, estado } = await request.json();
  if (typeof id !== 'string' || !ESTADOS.includes(estado)) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  await cambiarEstado(id, estado);
  return NextResponse.json({ ok: true });
}
