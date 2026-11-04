import capitulosElCamino from './elCaminoCapitulos.json';

// Radionovelas: series de ficción sonora por capítulos. El primer capítulo de cada una es gratis; los demás son
// un beneficio de la membresía de /apoya (lib/miembrosApoya.ts). El audio de cada capítulo está en Storage como
// radionovelas/<slug>/capNN.mp3. Los capítulos (líneas con tiempo, personaje y texto, y marcas de escena) se
// generan con los scripts de montaje de cada capítulo (ver scripts/audiolibros/README.md, «Radionovelas»).
export type LineaRadionovela = { t: number; e: number; p: string; x: string };
export type Capitulo = {
  n: number;
  titulo: string;
  resumen: string;
  duracion: number;
  lineas: LineaRadionovela[];
  escenas: { t: number; x: string }[];
};
export type Personaje = { nombre: string; edad: string; color: string; inicial?: string };
export type Radionovela = {
  slug: string;
  titulo: string;
  lema: string;
  descripcion: string;
  personajes: Record<string, Personaje>;
  // Personajes que no se presentan con su nombre hasta cierto capítulo (la voz misteriosa, el muchacho del río).
  ocultos?: Record<string, { hasta: number; nombre: string }>;
  aviso: string;
  capitulos: Capitulo[];
  // Cambia cada vez que se reemplazan los audios en Storage (se sirven como immutable).
  versionAudio: string;
};

export const RADIONOVELAS: Radionovela[] = [
  {
    slug: 'el-camino-que-dejamos-atras',
    titulo: 'El camino que dejamos atrás',
    lema: 'Una radionovela sobre los que se van… y los que se quedan.',
    descripcion:
      'Ernesto pierde su empleo y decide unirse a una caravana rumbo a Estados Unidos. Una historia de migración, familia y esperanza en 8 capítulos, de Armando Roque Godoy.',
    personajes: {
      N: { nombre: 'Narrador', edad: '', color: '#f2a03d' },
      E: { nombre: 'Ernesto', edad: '43 años', color: '#6fb7ff' },
      M: { nombre: 'Marta', edad: '39 años', color: '#ff8fab' },
      D: { nombre: 'Daniel', edad: '16 años', color: '#7ee0a1' },
      S: { nombre: 'Sofía', edad: '8 años', color: '#ffd166' },
      C: { nombre: 'Don Chepe', edad: '52 años', color: '#c9a27e', inicial: 'Ch' },
      V: { nombre: 'Doña Carmen', edad: 'mamá de Ernesto', color: '#b79cff' },
      Y: { nombre: 'Yeni', edad: '24 años', color: '#5ed6d6' },
      R: { nombre: 'Lic. Reyes', edad: '55 años', color: '#a0b0c4', inicial: 'R' },
      J: { nombre: 'Josué', edad: '17 años', color: '#bee65a' },
    },
    ocultos: { V: { hasta: 2, nombre: 'Voz de mujer' }, J: { hasta: 7, nombre: 'Un muchacho' } },
    aviso:
      'El camino que dejamos atrás es una obra de ficción. Sus personajes no existen, pero sus historias se parecen a las de miles de familias hondureñas.',
    capitulos: capitulosElCamino as Capitulo[],
    versionAudio: '1',
  },
];

export function getRadionovela(slug: string): Radionovela | undefined {
  return RADIONOVELAS.find((r) => r.slug === slug);
}

export function capituloGratis(n: number) {
  return n === 1;
}
