import type { ImagenInline } from '@/lib/inventarMiFuturoImagenes';

// Fotos de «San Pedro Sula: el valle que se hizo ciudad». Están en Storage como
// historias/san-pedro-sula/fotos/NN.jpg. afterCueIdx -1 = la portada, arriba de todo.
// De la 29 a la 33 son infografías hechas con IA que acompañan el podcast del final.
const foto = (n: string) => `/api/historias/san-pedro-sula/foto/${n}.jpg`;

export const imagenesSanPedroSula: ImagenInline[] = [
  {
    afterCueIdx: -1,
    src: foto('00'),
    alt: 'Vista aérea de San Pedro Sula con la cordillera del Merendón al fondo',
    caption: 'San Pedro Sula y, al fondo, el Merendón.',
  },
  {
    afterCueIdx: 6,
    src: foto('01'),
    alt: 'Armando Roque Godoy en un balcón con la ciudad de San Pedro Sula detrás',
    caption: 'Armando Roque Godoy, autor de este libro.',
  },
  {
    afterCueIdx: 11,
    src: foto('02'),
    alt: 'La ciudad extendida en el valle, vista desde lo alto del Merendón',
    caption: 'El valle de Sula visto desde el Merendón.',
  },
  {
    afterCueIdx: 12,
    src: foto('03'),
    alt: 'Un río crecido de aguas cafés en el valle',
    caption: 'Los ríos del valle dan vida a la tierra y, a veces, la ponen a prueba.',
  },
  {
    afterCueIdx: 15,
    src: foto('04'),
    alt: 'Cuatro aves de colores: guacamaya, colibrí, momoto y quetzal',
    caption: '«Usula», el valle de los pájaros.',
  },
  {
    afterCueIdx: 24,
    src: foto('06'),
    alt: 'Piezas arqueológicas de jade y concha sobre fondo negro',
    caption: 'Piezas de los antiguos pueblos del valle.',
  },
  {
    afterCueIdx: 26,
    src: foto('05'),
    alt: 'Vaso de mármol blanco tallado con asas en forma de animales',
    caption: 'Un vaso de mármol del Ulúa.',
  },
  {
    afterCueIdx: 29,
    src: foto('07'),
    alt: 'Mazorcas de cacao abiertas y semillas sobre madera',
    caption: 'El cacao: alimento, ofrenda y moneda.',
  },
  {
    afterCueIdx: 37,
    src: foto('09'),
    alt: 'Mapa de Honduras con sus departamentos',
    caption: 'Puerto Caballos estaba en la costa norte de Honduras, donde hoy se encuentra Puerto Cortés.',
  },
  {
    afterCueIdx: 39,
    src: foto('08'),
    alt: 'Retrato antiguo de Pedro de Alvarado con armadura y gorguera',
    caption: 'Pedro de Alvarado, fundador de la villa de San Pedro.',
  },
  {
    afterCueIdx: 42,
    src: foto('10'),
    alt: 'Escudo de armas de San Pedro Sula',
    caption: 'El escudo de San Pedro Sula.',
  },
  {
    afterCueIdx: 57,
    src: foto('11'),
    alt: "Grabado antiguo del pirata François l'Olonnais con una espada",
    caption: "François l'Olonnais en un grabado antiguo.",
  },
  {
    afterCueIdx: 61,
    src: foto('12'),
    alt: 'Murallas de piedra de la Fortaleza de San Fernando de Omoa',
    caption: 'La Fortaleza de San Fernando de Omoa.',
  },
  {
    afterCueIdx: 73,
    src: foto('13'),
    alt: 'Postal antigua de una calle de San Pedro Sula con casas de madera de dos pisos',
    caption: 'Postal antigua de San Pedro Sula: la calle del Comercio.',
  },
  {
    afterCueIdx: 80,
    src: foto('15'),
    alt: 'Locomotora de vapor antigua en blanco y negro',
    caption: 'Una locomotora de vapor de la época del ferrocarril.',
  },
  {
    afterCueIdx: 88,
    src: foto('16'),
    alt: 'Trabajador cargando un racimo de banano en una plantación, en blanco y negro',
    caption: 'El oro verde: un trabajador carga un racimo de banano.',
  },
  {
    afterCueIdx: 96,
    src: foto('17'),
    alt: 'Foto antigua de una calle comercial con edificios de dos pisos y carros de época',
    caption: 'Comercios del centro de San Pedro Sula en la primera mitad del siglo veinte.',
  },
  {
    afterCueIdx: 97,
    src: foto('14'),
    alt: 'Desfile con una carroza frente al almacén Constantino J. Larach y Hermano',
    caption: 'Un desfile frente al almacén de Constantino J. Larach y Hermano, en el centro. Foto: Luis Eberhardt.',
  },
  {
    afterCueIdx: 99,
    src: foto('18'),
    alt: 'Iconostasio dorado con íconos pintados en una iglesia ortodoxa',
    caption: 'El iconostasio de la Iglesia Ortodoxa San Juan Bautista.',
  },
  {
    afterCueIdx: 113,
    src: foto('19'),
    alt: 'Trabajadores cosiendo prendas en una maquila',
    caption: 'Una maquila del valle de Sula.',
  },
  {
    afterCueIdx: 117,
    src: foto('20'),
    alt: 'Torres modernas de apartamentos en San Pedro Sula',
    caption: 'La San Pedro Sula de hoy.',
  },
  {
    afterCueIdx: 123,
    src: foto('21'),
    alt: 'Fachada de la Catedral de San Pedro Apóstol con sus dos torres',
    caption: 'La Catedral de San Pedro Apóstol, inaugurada en 1987.',
  },
  {
    afterCueIdx: 124,
    src: foto('22'),
    alt: 'Fachada del Museo de Antropología e Historia con un cañón antiguo al frente',
    caption: 'El Museo de Antropología e Historia de San Pedro Sula.',
  },
  {
    afterCueIdx: 126,
    src: foto('23'),
    alt: 'Multitud y carrozas en el carnaval de la Feria Juniana',
    caption: 'El carnaval de la Feria Juniana.',
  },
  {
    afterCueIdx: 127,
    src: foto('24'),
    alt: 'Vista aérea del Estadio General Francisco Morazán',
    caption: 'El Estadio General Francisco Morazán.',
  },
  {
    afterCueIdx: 137,
    src: foto('26'),
    alt: 'Puente ferroviario de hierro sobre el río Ulúa',
    caption: 'El puente ferroviario de Pimienta, antes de que el Ulúa lo destruyera en 2020.',
  },
  {
    afterCueIdx: 138,
    src: foto('25'),
    alt: 'Vista aérea del valle inundado, con una carretera entre el agua',
    caption: 'El valle de Sula bajo el agua, noviembre de 2020.',
  },
  {
    afterCueIdx: 139,
    src: foto('27'),
    alt: 'Vecinos cargando a una persona por una calle inundada',
    caption: 'Vecinos rescatando a vecinos.',
  },
  {
    afterCueIdx: 143,
    src: foto('28'),
    alt: 'Afiche «Celebrando 490 años, ¡Felicidades, Sampedranos!»',
    caption: 'San Pedro Sula celebra sus 490 años, junio de 2026.',
  },
  {
    afterCueIdx: 156,
    src: foto('29'),
    alt: 'Infografía: corte del valle de Sula entre el Merendón y los ríos Ulúa y Chamelecón',
    caption: 'La geografía del valle: el Merendón, el valle de Sula y sus ríos. Infografía hecha con inteligencia artificial.',
  },
  {
    afterCueIdx: 168,
    src: foto('30'),
    alt: 'Infografía: el tren, el banano y la «república bananera»',
    caption: 'Rieles y oro verde: del tren al banano. Infografía hecha con inteligencia artificial.',
  },
  {
    afterCueIdx: 172,
    src: foto('31'),
    alt: 'Infografía: las migraciones que hicieron la ciudad',
    caption: 'Una ciudad hecha por los que llegaron de lejos. Infografía hecha con inteligencia artificial.',
  },
  {
    afterCueIdx: 176,
    src: foto('32'),
    alt: 'Infografía: 62 % del PIB, 68 % de las exportaciones y más de 1.2 millones de habitantes',
    caption: 'El valle de Sula, motor económico de Honduras. Infografía hecha con inteligencia artificial.',
  },
  {
    afterCueIdx: 187,
    src: foto('33'),
    alt: 'Infografía de cierre: 490 años después, con un atardecer sobre las montañas',
    caption: '490 años después. Infografía hecha con inteligencia artificial.',
  },
];
