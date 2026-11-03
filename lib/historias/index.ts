import type { CuePárrafo } from '@/lib/inventarMiFuturoCues';
import type { ImagenInline } from '@/lib/inventarMiFuturoImagenes';
import { cuesSanPedroSula, duracionTotalSegundos as duracionSanPedroSula } from './sanPedroSulaCues';
import { imagenesSanPedroSula } from './sanPedroSulaImagenes';

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
export const HISTORIAS: Historia[] = [
  {
    slug: 'san-pedro-sula',
    lugar: 'San Pedro Sula',
    departamento: 'Cortés',
    titulo: 'San Pedro Sula: el valle que se hizo ciudad',
    descripcion:
      'De los pueblos del valle de Sula a la capital industrial: piratas, el tren, el banano, los que llegaron de lejos y los huracanes. 490 años de historia, de Armando Roque Godoy, con un podcast al final.',
    cues: cuesSanPedroSula,
    duracion: duracionSanPedroSula,
    imagenes: imagenesSanPedroSula,
    versionAudio: '2',
    // Muestra gratis: hasta el fin del capítulo 1, cortina y aviso hablado (voz del narrador).
    muestra: {
      ultimoCue: 33,
      duracion: 546.52,
      versionAudio: '1',
      aviso: [
        {
          start: 510.36,
          end: 515.78,
          text: 'Aquí termina la muestra gratuita de «San Pedro Sula: el valle que se hizo ciudad».',
          kind: 'heading',
        },
        {
          start: 516.44,
          end: 525.62,
          text: 'Si quieres seguir escuchando, te esperan ocho capítulos más, el epílogo y el podcast «El resurgimiento de San Pedro Sula»: casi una hora de historia.',
          kind: 'p',
        },
        {
          start: 526.26,
          end: 541.52,
          text: 'Cuando puedas, sin estar manejando, entra a corridos.online/historias/san-pedro-sula y toca el botón «Escuchar el libro completo». Es un solo pago de US$ 4.99, y el libro queda tuyo para siempre.',
          kind: 'p',
        },
        { start: 542.82, end: 544.34, text: 'Gracias por escuchar.', kind: 'p' },
      ],
    },
  },
];

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
