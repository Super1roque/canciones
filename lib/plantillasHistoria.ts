import { ETAPAS, type Etapa } from './etapasHistoria';

// Mi Historia nació para autobiografías ('vida': la persona cuenta su propia
// vida). 'homenaje' reutiliza toda la plataforma —mismo link, misma
// entrevista, mismas fotos, misma Memoria— pero la persona cuenta la vida
// de OTRO (un padre, una abuela, alguien que ya murió). Solo cambian las
// preguntas, algunos textos de la UI y el contexto que se le da a la IA.
export type Plantilla = 'vida' | 'homenaje';

export const PLANTILLAS: { id: Plantilla; nombre: string; descripcion: string }[] = [
  { id: 'vida', nombre: 'Mi Historia (autobiografía)', descripcion: 'La persona cuenta su propia vida.' },
  { id: 'homenaje', nombre: 'Homenaje a un ser querido', descripcion: 'La persona cuenta la vida de otra (un padre, una abuela, alguien que ya partió).' },
];

export function esPlantilla(v: unknown): v is Plantilla {
  return v === 'vida' || v === 'homenaje';
}

// {H} se reemplaza por el nombre del homenajeado (ver etapasDe) — así las
// preguntas dicen "¿Dónde nació Don Emigdio?" en vez de "esta persona".
const ETAPAS_HOMENAJE: Etapa[] = [
  { titulo: 'Quién es {H}', preguntas: [
    '¿Cuál es el nombre completo de {H}?', '¿Cómo le decían en la familia y entre sus amigos?', '¿Qué relación tienes tú con {H}?',
    '¿Cuándo y dónde nació?', '¿{H} vive todavía? Si ya partió, ¿cuándo fue?',
    'Si tuvieras que describir a {H} en tres palabras, ¿cuáles serían?',
    '¿Por qué quieres hacerle este homenaje?', 'Si su vida pudiera resumirse en una sola frase, ¿cuál sería?',
  ]},
  { titulo: 'Sus orígenes', preguntas: [
    '¿Cómo era el lugar donde nació y creció {H}?', '¿Cómo se llamaban sus padres y qué sabes de ellos?', '¿Tenía hermanos? ¿Cómo se llamaban?',
    '¿Cómo era económicamente su familia?', '¿Qué historias contaba {H} de su infancia?', '¿Qué travesura o anécdota de niño(a) se sigue contando en la familia?',
    '¿Quién te contó todo esto? ¿Hay alguien que conozca mejor esa parte de su vida?',
  ]},
  { titulo: 'Su juventud', preguntas: [
    '¿Hasta dónde estudió {H} y dónde?', '¿Cuál fue su primer trabajo?', '¿Qué soñaba ser o hacer cuando era joven?',
    '¿Quiénes eran sus amigos de juventud?', '¿Qué le gustaba hacer en esos años: música, bailes, deportes?',
    '¿Hay alguna aventura o anécdota de su juventud que siempre se cuente?', '¿Qué decisión de joven marcó el resto de su vida?',
  ]},
  { titulo: 'El amor y la familia', preguntas: [
    '¿Cómo conoció {H} a su pareja?', '¿Cómo fue el noviazgo y la boda, si la hubo?', '¿Cuántos hijos tuvo y cómo se llaman?',
    '¿Cómo era {H} como padre o madre?', '¿Cómo era un día normal en la casa?', '¿Qué costumbres o tradiciones familiares mantenía?',
    '¿Cómo se celebraban la Navidad, los cumpleaños o las fiestas con {H}?',
  ]},
  { titulo: 'Su trabajo y su lucha', preguntas: [
    '¿A qué se dedicó {H} la mayor parte de su vida?', '¿Cómo se ganaba la vida para sacar adelante a la familia?', '¿Qué sacrificios hizo que tal vez pocos conocen?',
    '¿Cuál fue su mayor logro?', '¿Tuvo algún fracaso o tropiezo importante? ¿Cómo lo enfrentó?', '¿Qué decían de {H} sus compañeros, clientes o vecinos?',
  ]},
  { titulo: 'Cómo era', preguntas: [
    '¿Cómo era su carácter?', '¿Qué frases o dichos repetía siempre?', '¿Cuál era su comida favorita? ¿Cocinaba algo especial?',
    '¿Qué música le gustaba?', '¿Qué lo hacía reír? ¿Y qué lo hacía enojar?', '¿Tenía alguna manía, costumbre o detalle que lo hacía único?',
    '¿Qué lugar ocupaba la fe o la religión en su vida?', '¿Cómo se vestía? ¿Hay algún objeto que siempre lo acompañaba?',
  ]},
  { titulo: 'Lo que vivimos juntos', preguntas: [
    '¿Cuál es tu primer recuerdo con {H}?', '¿Qué hacían juntos que más disfrutabas?', '¿Cuál es el momento más feliz que viviste con {H}?',
    '¿Hubo algún viaje, paseo o aventura juntos que nunca olvidas?', '¿Hay una conversación con {H} que se te quedó grabada?',
    '¿Hubo algún desacuerdo o momento difícil entre ustedes? ¿Cómo lo resolvieron?', '¿Qué sentías cuando estabas con {H}?',
  ]},
  { titulo: 'Los momentos difíciles', preguntas: [
    '¿Cuál fue la etapa más dura en la vida de {H}?', '¿Qué ocurrió?', '¿Cómo lo enfrentó? ¿Quién lo acompañó?',
    '¿Qué cambió en {H} después de eso?', '¿Hubo enfermedades o pérdidas que lo marcaron?',
  ]},
  { titulo: 'Lo que nos enseñó', preguntas: [
    '¿Qué es lo más importante que aprendiste de {H}?', '¿Qué consejo te dio que todavía recuerdas?', '¿Qué valores defendía siempre?',
    '¿Qué heredaste de {H}: un gesto, una costumbre, una forma de ser?', '¿En qué momentos de tu vida piensas "esto lo haría {H}"?',
  ]},
  { titulo: 'Otras voces', intro: 'Esta etapa es para lo que otros recuerdan de {H}. Si puedes, pregúntale a hermanos, primos, amigos o vecinos y escribe aquí lo que te cuenten, diciendo quién lo contó.', grandes: true, preguntas: [
    '¿Qué anécdota de {H} cuentan sus hermanos o familiares?', '¿Qué recuerdan sus amigos o compañeros?',
    '¿Qué dicen de {H} sus nietos o los más jóvenes de la familia?', '¿Quiénes fueron las personas más importantes en su vida?',
  ]},
  { titulo: 'La despedida', intro: 'Si {H} todavía vive, puedes saltar esta etapa con "Prefiero no responder" o contar cómo vive hoy.', preguntas: [
    '¿Cómo fueron sus últimos años?', '¿Cómo fue su partida? ¿Quién estaba con {H}?', '¿Te dijo algo en sus últimos días que quieras guardar?',
    '¿Cómo fue la despedida: el velorio, el entierro, quiénes llegaron?', '¿Cómo cambió la familia después de su partida?',
  ]},
  { titulo: 'Su legado', preguntas: [
    '¿Cómo quieres que recuerden a {H} los que no lo conocieron?', '¿Qué quisieras que sus nietos y bisnietos sepan de {H}?',
    'Si pudieras decirle algo hoy, ¿qué le dirías?', 'Si pudieras escribirle una carta, ¿qué le escribirías?',
    '¿Qué título le pondrías a este libro?', '¿Qué te gustaría que sintiera quien termine de leerlo?',
  ]},
];

function reemplazarH(texto: string, homenajeado: string): string {
  return texto.replace(/\{H\}/g, homenajeado);
}

// Las etapas que corresponden a un link, ya personalizadas. Si es un
// homenaje sin nombre cargado (no debería pasar: el admin lo pide al
// generar el link), se usa "esta persona" para que la pregunta se lea bien.
export function etapasDe(plantilla: Plantilla | undefined, homenajeado?: string): Etapa[] {
  if (plantilla !== 'homenaje') return ETAPAS;
  const h = (homenajeado || '').trim() || 'esta persona';
  return ETAPAS_HOMENAJE.map(e => ({
    ...e,
    titulo: reemplazarH(e.titulo, h),
    intro: e.intro ? reemplazarH(e.intro, h) : undefined,
    preguntas: e.preguntas.map(p => reemplazarH(p, h)),
  }));
}

// Va antes del Prompt Maestro al exportar para IA (y como contexto en la
// vista previa y las preguntas de seguimiento): el Prompt Maestro está
// escrito para autobiografías en primera persona, y en un homenaje quien
// responde NO es el protagonista.
export function contextoHomenaje(homenajeado: string, narrador: string): string {
  return `CONTEXTO IMPORTANTE — LIBRO HOMENAJE
Este material NO es autobiográfico. Quien respondió el cuestionario es ${narrador || 'un familiar o persona cercana'}, y lo que cuenta es la vida de ${homenajeado || 'un ser querido'}, el protagonista del libro.
- El protagonista es ${homenajeado || 'el homenajeado'}, no quien responde.
- Escribe en tercera persona, o desde la voz de quien lo recuerda ("mi padre…") cuando el material sea un recuerdo personal. Nunca en primera persona del homenajeado: no se le pueden poner palabras en la boca.
- Las reglas de veracidad se mantienen: no inventes hechos, fechas, diálogos ni personas. Si algo lo contó un tercero, puede atribuirse ("según cuenta su hermana…").
- El tono es de homenaje: cálido y agradecido, pero honesto. Sin idealizar ni ocultar lo que el material cuenta.`;
}
