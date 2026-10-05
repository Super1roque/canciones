/**
 * GET /api/pexels-quota
 * Devuelve el cupo de la API de Pexels leyendo los headers de rate-limit
 * (x-ratelimit-*) que Pexels manda en cada respuesta — no hay un endpoint
 * dedicado para esto, así que se pide 1 resultado mínimo solo para leer los
 * headers. Se cachea en memoria un rato para no gastar cupo cada vez que
 * alguien abre la página.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { limit: number; remaining: number; reset: number; cachedAt: number } | null = null;

export async function GET() {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'PEXELS_API_KEY no configurada en el servidor' }, { status: 500 });
  }

  if (cache && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache);
  }

  try {
    const res = await fetch('https://api.pexels.com/videos/search?query=a&per_page=1', {
      headers: { Authorization: apiKey },
    });
    const limit = parseInt(res.headers.get('x-ratelimit-limit') ?? '', 10);
    const remaining = parseInt(res.headers.get('x-ratelimit-remaining') ?? '', 10);
    const reset = parseInt(res.headers.get('x-ratelimit-reset') ?? '', 10);

    if (!res.ok || isNaN(limit) || isNaN(remaining) || isNaN(reset)) {
      return NextResponse.json({ error: 'Pexels no devolvió el cupo' }, { status: 502 });
    }

    cache = { limit, remaining, reset, cachedAt: Date.now() };
    return NextResponse.json(cache);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error consultando el cupo' }, { status: 500 });
  }
}
