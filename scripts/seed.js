// Seed: carga las canciones de ejemplo en Firebase Firestore
// Uso: node scripts/seed.js
require('dotenv').config();
const { db } = require('../services/firebaseService');

const canciones = [
  {
    nombre: 'La Vida Es Bella',
    estilo: 'Pop',
    letra: '[VERSO 1]\nCada mañana me levanto\ncon ganas de empezar\nel sol me llena de encanto\ny todo va a brillar\n\n[PRE-CORO]\nNo hay nada que me detenga\nel mundo es para mí\naunque la lluvia me venga\nseguiré hasta el fin\n\n[CORO]\nLa vida es bella, es un regalo\nhay que vivirla sin parar\ncon cada sueño que yo hablo\nel mundo puedo transformar\n\n[VERSO 2]\nLas flores en el camino\nme hablan de amor\nsigo mi propio destino\ncon fuerza y valor\n\n[PRE-CORO]\nNo hay nada que me detenga\nel mundo es para mí\naunque la lluvia me venga\nseguiré hasta el fin\n\n[CORO]\nLa vida es bella, es un regalo\nhay que vivirla sin parar\ncon cada sueño que yo hablo\nel mundo puedo transformar\n\n[PUENTE]\nY si algún día la oscuridad\nquiere robarme mi alegría\nla luz vencerá la adversidad\ny brillará un nuevo día\n\n[CORO FINAL]\nLa vida es bella, es un regalo\nhay que vivirla sin parar\ncon cada sueño que yo hablo\nel mundo puedo transformar',
  },
  {
    nombre: 'Mi Tierra',
    estilo: 'Balada',
    letra: '[VERSO 1]\nTierra mía de colores\ndonde crecí con amor\nentre jardines y flores\nbajo el mismo sol mayor\n\n[VERSO 2]\nCada piedra cada río\nguarda historias de ayer\nen el viento frío y brío\nme recuerda tu querer\n\n[CORO]\nMi tierra querida\ntierra de mis sueños\nen ti está mi vida\ny todos mis empeños\n\n[PUENTE]\nAunque lejos esté de ti\nsiempre vuelvo a recordar\nque lo mejor lo encontré aquí\nen tu abrazo familiar\n\n[CORO FINAL]\nMi tierra querida\ntierra de mis sueños\nen ti está mi vida\ny todos mis empeños',
  },
  {
    nombre: 'Fiesta de Verano',
    estilo: 'Cumbia',
    letra: '[VERSO 1]\nLlegó el verano con su calor\nla gente baila sin parar\nel ritmo suena con mucho sabor\na nadie le gusta descansar\n\n[PRE-CORO]\nMueve el cuerpo\nsuelta el alma\nque la música nos calma\ny el corazón late al son\n\n[CORO]\nEs la fiesta del verano\ntodos juntos a bailar\ndame tu mano hermano\ny vamos a gozar\n\n[VERSO 2]\nLas maracas y el tambor\nllenan el aire de emoción\ncompartimos el mejor\nritmo lleno de pasión\n\n[PRE-CORO]\nMueve el cuerpo\nsuelta el alma\nque la música nos calma\ny el corazón late al son\n\n[CORO]\nEs la fiesta del verano\ntodos juntos a bailar\ndame tu mano hermano\ny vamos a gozar\n\n[PUENTE]\nEsta noche no hay cansancio\ntodo el barrio se une aquí\nen un gran abrazo amplio\ncelebramos hasta el fin\n\n[CORO FINAL]\nEs la fiesta del verano\ntodos juntos a bailar\ndame tu mano hermano\ny vamos a gozar',
  },
];

async function seed() {
  console.log('Conectando a Firestore...');
  const col = db.collection('canciones');

  for (const cancion of canciones) {
    const ref = await col.add(cancion);
    console.log(`✓ "${cancion.nombre}" — ID: ${ref.id}`);
  }

  console.log('\nSeed completado.');
  process.exit(0);
}

seed().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
