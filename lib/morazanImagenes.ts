import type { ImagenInline } from './inventarMiFuturoImagenes';

// afterCueIdx -1 = la portada, arriba de todo. Las demás, en el mismo lugar que en el libro.
// Están en public/morazan/fotos (son las del ePub, ya reducidas).
export const imagenesMorazan: ImagenInline[] = [
  {
    afterCueIdx: -1,
    src: '/morazan/cubierta.jpg',
    alt: 'Portada: grabado de perfil de Francisco Morazán',
    caption: '',
  },
  {
    afterCueIdx: 5,
    src: '/morazan/fotos/01.jpg',
    alt: 'Retrato de Armando Roque Godoy escribiendo en un cuaderno, en una biblioteca',
    caption: 'Armando Roque Godoy, autor de este homenaje.',
  },
  {
    afterCueIdx: 17,
    src: '/morazan/fotos/02.jpg',
    alt: 'Recreación moderna del testamento de Morazán',
    caption:
      'Recreación moderna del testamento de Francisco Morazán, fechado en San José el 15 de septiembre de 1842. El original se conserva en el Archivo Nacional de Costa Rica.',
  },
  {
    afterCueIdx: 26,
    src: '/morazan/fotos/03.jpg',
    alt: 'Grabado de Tegucigalpa en 1890',
    caption: 'Grabado de Tegucigalpa en 1890, casi un siglo después del nacimiento de Morazán.',
  },
  {
    afterCueIdx: 35,
    src: '/morazan/fotos/04.jpg',
    alt: 'Grabado de la Catedral de Comayagua',
    caption: 'Catedral de Comayagua, donde Francisco Morazán y María Josefa Lastiri se casaron el 30 de diciembre de 1825.',
  },
  {
    afterCueIdx: 36,
    src: '/morazan/fotos/05.jpg',
    alt: 'Pintura de María Josefa Lastiri Lozano',
    caption: 'Pintura de doña María Josefa Lastiri Lozano, esposa de Francisco Morazán. Museo de Comayagua, Honduras.',
  },
  {
    afterCueIdx: 50,
    src: '/morazan/fotos/06.jpg',
    alt: 'Dos retratos de Francisco Morazán: óleo y grabado',
    caption: 'Francisco Morazán, presidente de la República Federal de Centroamérica (1830–1834 y 1835–1839).',
  },
  {
    afterCueIdx: 52,
    src: '/morazan/fotos/07.jpg',
    alt: 'Mapa de la República Federal de Centroamérica junto a un retrato de Morazán',
    caption: 'La República Federal de Centroamérica, el proyecto de unión que Morazán defendió toda su vida.',
  },
  {
    afterCueIdx: 87,
    src: '/morazan/fotos/08.jpg',
    alt: 'Mapa del recorrido de la vida de Francisco Morazán',
    caption:
      'El camino de una vida: Tegucigalpa, Comayagua, Guatemala, San Salvador, Panamá, Perú y San José, donde fue fusilado. Mapa esquemático.',
  },
  {
    afterCueIdx: 89,
    src: '/morazan/fotos/09.jpg',
    alt: 'Ilustración moderna del fusilamiento de Morazán',
    caption:
      'Recreación artística del fusilamiento de Francisco Morazán en San José, Costa Rica, el 15 de septiembre de 1842.',
  },
];
