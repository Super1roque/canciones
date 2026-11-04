import capitulosElCamino from './elCaminoCapitulos.json';
import capitulosDonMario from './donMarioCapitulos.json';

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
  {
    slug: 'las-giras-de-don-mario',
    titulo: 'Las giras de don Mario',
    lema: 'Una radionovela de humor sobre un político, un cobrador… y una tasita de café.',
    descripcion:
      'Años 80: don Mario recorre los pueblos en su jeep, perseguido por el cobrador de don Jaime, hasta que una viejecita le ofrece una tasita de café. Una comedia en 4 capítulos de Armando Roque Godoy, inspirada en una anécdota popular hondureña.',
    personajes: {
      N: { nombre: 'Narrador', edad: '', color: '#f2a03d' },
      M: { nombre: 'Don Mario', edad: 'político de antaño', color: '#ff6b6b', inicial: 'M' },
      T: { nombre: 'Toribio', edad: 'su chofer', color: '#7ee0a1' },
      R: { nombre: 'Doña Rosaura', edad: 'correligionaria', color: '#ff8fab', inicial: 'R' },
      A: { nombre: 'El alcalde', edad: 'Santa Rita', color: '#ffd166', inicial: 'Al' },
      G: { nombre: 'Lic. Arriaga', edad: 'el cobrador', color: '#a0b0c4', inicial: 'Ar' },
      P: { nombre: 'Padre Anselmo', edad: 'San Isidro', color: '#c9a27e' },
      O: { nombre: 'Doña Toña', edad: 'San Isidro', color: '#5ed6d6', inicial: 'To' },
      L: { nombre: 'Doña Lupita', edad: 'la del café', color: '#b79cff', inicial: 'L' },
      U: { nombre: 'La de la pulpería', edad: 'la aldea', color: '#5ed6d6', inicial: 'Pu' },
      X: { nombre: 'El locutor', edad: 'la radio', color: '#bee65a' },
    },
    aviso:
      'Las giras de don Mario es una obra de ficción y humor, inspirada en una anécdota popular hondureña. Cualquier parecido con la realidad es pura coincidencia.',
    capitulos: capitulosDonMario as Capitulo[],
    versionAudio: '1',
  },
];

export function getRadionovela(slug: string): Radionovela | undefined {
  return RADIONOVELAS.find((r) => r.slug === slug);
}

export function capituloGratis(n: number) {
  return n === 1;
}
