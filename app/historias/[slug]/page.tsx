import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import InventarMiFuturoClient from '@/components/InventarMiFuturoClient';
import AccesoAudiolibro from '@/components/AccesoAudiolibro';
import { tokenValido } from '@/lib/accesoAudiolibros';
import { checkoutHistoria, cookieHistoria, getHistoria } from '@/lib/historias';

// Plantilla de todos los libros de «Historias de Honduras». Mismo lector sincronizado y misma venta
// que /morazan: si el libro tiene checkout, quien no compró escucha la muestra y al final ve el botón
// de compra; quien compró (cookie) escucha el libro completo. Sin checkout, el libro es gratis.
type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ compra?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const h = getHistoria((await params).slug);
  if (!h) return {};
  const url = `https://corridos.online/historias/${h.slug}`;
  const titulo = `🎧 ${h.titulo} — Historias de Honduras`;
  const descripcion = checkoutHistoria(h) ? `${h.descripcion} Escucha gratis el primer capítulo.` : h.descripcion;
  const imagen = `/historias/${h.slug}/portada.jpg`;
  return {
    title: titulo,
    description: descripcion,
    openGraph: {
      title: titulo,
      description: descripcion,
      images: [{ url: imagen, width: 1200, height: 675, type: 'image/jpeg' }],
      url,
      siteName: 'Canciones',
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: titulo, description: descripcion, images: [imagen] },
  };
}

function MasHistorias() {
  return (
    <p style={{ marginTop: '1.5rem', fontSize: '0.95rem' }}>
      <Link href="/historias" style={{ color: '#6ee7b7' }}>
        📚 Más historias de pueblos y lugares de Honduras
      </Link>
    </p>
  );
}

export default async function HistoriaPage({ params, searchParams }: Params) {
  const h = getHistoria((await params).slug);
  if (!h) notFound();
  const url = `https://corridos.online/historias/${h.slug}`;
  const checkout = checkoutHistoria(h);
  const compro = checkout ? await tokenValido(h.slug, (await cookies()).get(cookieHistoria(h.slug))?.value) : false;
  const etiqueta = `Historias de Honduras · ${h.departamento}`;

  if (checkout && !compro && h.muestra) {
    // Hotmart devuelve al comprador a ?compra=ok: ahí no se le vuelve a ofrecer la compra.
    const recienCompro = (await searchParams).compra === 'ok';
    const m = h.muestra;
    return (
      <InventarMiFuturoClient
        audioUrl={`/api/historias/${h.slug}/audio?parte=muestra&v=${m.versionAudio}`}
        titulo={h.titulo}
        subtitulo={h.lugar}
        cues={[...h.cues.slice(0, m.ultimoCue + 1), ...(m.aviso ?? [])]}
        duracionTotal={m.duracion}
        imagenes={h.imagenes.filter((img) => img.afterCueIdx <= m.ultimoCue)}
        etiqueta={`${etiqueta} · Primer capítulo gratis`}
        firma="🎧 ¿Te gustó el primer capítulo?"
        invitacion="La historia continúa en el libro completo"
        remate="un solo pago"
        cta={
          recienCompro
            ? { texto: '🎧 Abrir mi libro completo', href: '#acceso' }
            : { texto: '🎧 Escuchar el libro completo', href: checkout }
        }
        pie={
          <>
            <AccesoAudiolibro key="acceso" endpoint={`/api/historias/${h.slug}/desbloquear`} destino={`/historias/${h.slug}`} />
            <MasHistorias />
          </>
        }
      />
    );
  }

  const mensaje = checkout
    ? `Escucha gratis el primer capítulo de "${h.titulo}" 🎧 ${url}`
    : `Escucha "${h.titulo}", una historia de ${h.lugar} 🎧 ${url}`;
  return (
    <InventarMiFuturoClient
      audioUrl={`/api/historias/${h.slug}/audio?v=${h.versionAudio}`}
      titulo={h.titulo}
      subtitulo={h.lugar}
      cues={h.cues}
      duracionTotal={h.duracion}
      imagenes={h.imagenes}
      etiqueta={etiqueta}
      firma={`📍 Gracias por escuchar la historia de ${h.lugar}`}
      invitacion="Compártela, sobre todo con los que son de allá"
      remate={checkout ? 'el primer capítulo es gratis' : 'es gratis'}
      cta={{ texto: 'Compartir por WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(mensaje)}` }}
      pie={<MasHistorias />}
    />
  );
}
