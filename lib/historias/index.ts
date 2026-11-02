import type { CuePárrafo } from '@/lib/inventarMiFuturoCues';
import type { ImagenInline } from '@/lib/inventarMiFuturoImagenes';

// «Historias de Honduras»: audiolibros sobre pueblos, ciudades y lugares icónicos. Una sola
// plantilla (/historias/<slug>) sirve para todos; cada libro es solo una entrada de HISTORIAS.
// El proceso para producir uno está en scripts/audiolibros/README.md («Historias de Honduras»).
//
// En Storage, cada libro usa historias/<slug>/audio.mp3, historias/<slug>/muestra.mp3 (solo si
// se vende) e historias/<slug>/fotos/NN.jpg. La portada para compartir va en
// public/historias/<slug>/portada.jpg (1200×675).
export type Historia = {
  slug: string;
  lugar: string;              // «Copán Ruinas»
  departamento: string;       // «Copán»
  titulo: string;             // título del libro
  descripcion: string;        // para la tarjeta del índice y la vista previa al compartir
  cues: CuePárrafo[];
  duracion: number;
  imagenes: ImagenInline[];
  // Cambia cada vez que se reemplaza el audio en Storage: la ruta se sirve como immutable por un
  // año, y sin esto los navegadores seguirían con la versión vieja.
  versionAudio: string;
  // Solo si el libro se puede vender: hasta qué cue llega la muestra gratis y cuánto dura
  // muestra.mp3. La venta se activa al poner el checkout en Render (ver checkoutHistoria).
  muestra?: { ultimoCue: number; duracion: number; versionAudio: string; aviso?: CuePárrafo[] };
};

// Para publicar un libro: importar sus cues e imágenes y agregarlo aquí.
export const HISTORIAS: Historia[] = [];

export function getHistoria(slug: string): Historia | undefined {
  return HISTORIAS.find((h) => h.slug === slug);
}

// Cada libro se vende (o no) por su cuenta: con HISTORIA_<SLUG>_CHECKOUT en Render
// (ej. HISTORIA_COPAN_RUINAS_CHECKOUT) el libro pasa a venta con muestra gratis; sin esa
// variable, o si el libro no tiene muestra, se escucha completo gratis.
export function checkoutHistoria(h: Historia): string | null {
  if (!h.muestra) return null;
  return process.env[`HISTORIA_${h.slug.toUpperCase().replace(/-/g, '_')}_CHECKOUT`] || null;
}

export function cookieHistoria(slug: string) {
  return `acceso_${slug}`;
}
