import { NextResponse } from 'next/server';
import { obtenerHistoria, guardarHistoria, type HistoriaData } from '@/lib/miHistoriaService';

export const runtime = 'nodejs';

// clave = 'principal' para el admin, o el token del link para un tenant
// (ver app/historia/[clave]/page.tsx y lib/historiaLinksService.ts). Sin
// chequeo de sesión a propósito, mismo criterio que el resto de /api/admin/*
// en este proyecto — y acá además es intencional: el tenant entra SIN
// loguearse, solo con el link.
export async function GET(_request: Request, { params }: { params: Promise<{ clave: string }> }) {
  try {
    const { clave } = await params;
    const data = await obtenerHistoria(clave);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ clave: string }> }) {
  try {
    const { clave } = await params;
    const data = (await request.json()) as HistoriaData;
    await guardarHistoria(clave, data);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
