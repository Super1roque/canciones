import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import RadionovelaClient from '@/components/RadionovelaClient';
import { COOKIE_MIEMBRO, checkoutApoya, miembroActivo } from '@/lib/miembrosApoya';
import { capituloGratis, getRadionovela } from '@/lib/radionovelas';

// Página de una radionovela: reparto que se ilumina cuando habla cada personaje, guion sincronizado con el audio
// y lista de capítulos. El capítulo 1 es gratis; los demás se abren con la membresía de /apoya.
type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ cap?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const r = getRadionovela((await params).slug);
  if (!r) return {};
  const titulo = `🎙️ ${r.titulo} — radionovela`;
  const descripcion = `${r.descripcion} Escucha gratis el primer capítulo.`;
  const imagen = `/radionovelas/${r.slug}/og.jpg`;
  return {
    title: titulo,
    description: descripcion,
    openGraph: {
      title: titulo,
      description: descripcion,
      images: [{ url: imagen, width: 1200, height: 630, type: 'image/jpeg' }],
      url: `https://corridos.online/radionovelas/${r.slug}`,
      siteName: 'Canciones',
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: titulo, description: descripcion, images: [imagen] },
  };
}

export default async function RadionovelaPage({ params, searchParams }: Params) {
  const r = getRadionovela((await params).slug);
  if (!r) notFound();
  const pedido = parseInt((await searchParams).cap || '1', 10);
  const cap = r.capitulos.find((c) => c.n === pedido) ?? r.capitulos[0];
  const miembro = await miembroActivo((await cookies()).get(COOKIE_MIEMBRO)?.value);
  const abierto = capituloGratis(cap.n) || miembro;
  return (
    <RadionovelaClient
      slug={r.slug}
      titulo={r.titulo}
      lema={r.lema}
      aviso={r.aviso}
      estilo={r.estilo}
      etiqueta={r.etiqueta}
      personajes={r.personajes}
      ocultos={r.ocultos ?? {}}
      capitulo={abierto ? cap : { ...cap, lineas: [], escenas: [] }}
      indice={r.capitulos.map((c) => ({ n: c.n, titulo: c.titulo, duracion: c.duracion, gratis: capituloGratis(c.n) }))}
      abierto={abierto}
      miembro={miembro}
      audioUrl={`/api/radionovelas/${r.slug}/${cap.n}?v=${r.versionAudio}`}
      checkout={checkoutApoya()}
    />
  );
}
