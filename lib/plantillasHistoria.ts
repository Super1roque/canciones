import { ETAPAS, type Etapa } from './etapasHistoria';

// Mi Historia nació para autobiografías ('vida': la persona cuenta su propia
// vida). Las otras plantillas reutilizan toda la plataforma —mismo link,
// misma entrevista, mismas fotos, misma Memoria— y solo cambian las
// preguntas, algunos textos de la UI y el contexto que se le da a la IA:
// - 'homenaje': la persona cuenta la vida de OTRO (un padre, una abuela).
// - 'cuento': la persona crea un cuento infantil para un niño o niña. Es la
//   única plantilla de ficción: acá sí se puede inventar.
export type Plantilla = 'vida' | 'homenaje' | 'cuento';

export const PLANTILLAS: { id: Plantilla; nombre: string; descripcion: string }[] = [
  { id: 'vida', nombre: 'Mi Historia (autobiografía)', descripcion: 'La persona cuenta su propia vida.' },
  { id: 'homenaje', nombre: 'Homenaje a un ser querido', descripcion: 'La persona cuenta la vida de otra (un padre, una abuela, alguien que ya partió).' },
  { id: 'cuento', nombre: 'Cuento infantil', descripcion: 'La persona crea un cuento para un niño o niña (un nieto, un hijo).' },
];

export function esPlantilla(v: unknown): v is Plantilla {
  return v === 'vida' || v === 'homenaje' || v === 'cuento';
}

// De quién se habla en las preguntas: el homenajeado en un homenaje, el niño
// o niña para quien es el cuento en un cuento. Vacío en una autobiografía.
export function sujetoDe(link: { plantilla?: Plantilla; homenajeado?: string; paraQuien?: string } | null | undefined): string {
  if (link?.plantilla === 'homenaje') return link.homenajeado || '';
  if (link?.plantilla === 'cuento') return link.paraQuien || '';
  return '';
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

// {H} acá es el niño o niña para quien es el cuento. Las preguntas siguen la
// estructura clásica (protagonista → mundo → problema → aventura → final)
// pero con palabras sencillas: quien responde suele ser un abuelo o un papá,
// no un escritor.
const ETAPAS_CUENTO: Etapa[] = [
  { titulo: 'Un cuento para {H}', preguntas: [
    '¿Cuántos años tiene {H}?', '¿Qué es lo que más le gusta a {H}: animales, juegos, comidas, lugares?', '¿Cómo es {H}? ¿Tímido, valiente, curioso, travieso, cariñoso?',
    '¿Qué cosas le dan miedo o le cuestan?', '¿Quién eres tú para {H}?', '¿Por qué quieres regalarle este cuento?',
    '¿Qué te gustaría que {H} aprenda o sienta con este cuento?',
  ]},
  { titulo: 'La idea', preguntas: [
    'Si tuvieras que contar de qué trata el cuento en una sola frase, ¿qué dirías?',
    '¿El cuento nace de algo real —un recuerdo tuyo, una historia de la familia, algo que vivió {H}— o es inventado de principio a fin?',
    'Si se basa en algo real, cuéntalo como pasó.', '¿Cómo quieres que sea: de aventura, de risa, de ternura, de misterio, mágico?',
  ]},
  { titulo: 'El protagonista', preguntas: [
    '¿Quién es el protagonista? Puede ser {H}, un animal, un juguete o alguien inventado.', '¿Cómo se llama y cómo es por fuera: tamaño, color, ropa, algo especial?',
    '¿Cómo es por dentro? ¿Qué lo hace único?', '¿Qué es lo que más desea?', '¿Qué le falta o qué le da miedo?',
    '¿Tiene un amigo o compañero de aventuras? ¿Cómo es?',
  ]},
  { titulo: 'El mundo del cuento', preguntas: [
    '¿Dónde ocurre el cuento: un pueblo, una finca, el mar, el bosque, la casa de los abuelos, un mundo inventado?', '¿Cómo se ve, cómo huele y cómo suena ese lugar?',
    '¿Hay algo mágico o fuera de lo común en ese mundo?', '¿Quiénes más viven ahí?',
  ]},
  { titulo: 'El problema', preguntas: [
    '¿Qué pasa un día que lo cambia todo?', '¿Qué problema tiene que resolver el protagonista?', '¿Quién o qué se interpone? (Sin que dé demasiado miedo.)',
    '¿Qué pasaría si no lo logra?',
  ]},
  { titulo: 'La aventura', grandes: true, preguntas: [
    '¿Qué intenta primero el protagonista? ¿Le sale bien o mal?', '¿Quién lo ayuda en el camino?', '¿Cuál es el momento más difícil o más emocionante?',
    '¿Qué cualidad suya (valentía, ingenio, bondad, paciencia) lo saca adelante?', '¿Hay alguna parte divertida, de esas que hacen reír a {H}?',
  ]},
  { titulo: 'El final', preguntas: [
    '¿Cómo se resuelve el problema?', '¿Cómo termina el cuento? ¿Qué pasa con cada personaje?', '¿Qué aprendió el protagonista?',
    '¿Con qué frase quieres cerrar el cuento?',
  ]},
  { titulo: 'Los detalles que lo hacen nuestro', preguntas: [
    '¿Hay palabras, dichos o apodos de la familia que quieras que aparezcan?', '¿Quieres que aparezcan personas de la familia, mascotas o lugares reales? ¿Cuáles?',
    '¿Hay alguna canción, rima o juego que quieras incluir?', '¿Cómo te imaginas los dibujos del cuento?',
    '¿Qué título le pondrías?', '¿Qué dedicatoria le escribirías a {H}?',
  ]},
];

function reemplazarH(texto: string, sujeto: string): string {
  return texto.replace(/\{H\}/g, sujeto);
}

// Las etapas que corresponden a un link, ya personalizadas con el nombre del
// sujeto (ver sujetoDe). Si falta el nombre (no debería pasar: el admin lo
// pide al generar el link), se usa un genérico para que la pregunta se lea bien.
export function etapasDe(plantilla: Plantilla | undefined, sujeto?: string): Etapa[] {
  if (plantilla !== 'homenaje' && plantilla !== 'cuento') return ETAPAS;
  const base = plantilla === 'homenaje' ? ETAPAS_HOMENAJE : ETAPAS_CUENTO;
  const h = (sujeto || '').trim() || (plantilla === 'homenaje' ? 'esta persona' : 'el niño o la niña');
  return base.map(e => ({
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

// Reemplaza al Prompt Maestro en los cuentos: el Maestro prohíbe inventar
// (es para vidas reales), y un cuento es ficción. Sirve tanto de system
// prompt del adelanto como de encabezado al exportar para IA.
export function promptCuento(paraQuien: string, autor: string): string {
  const nino = paraQuien || 'el niño o la niña';
  return `# PROMPT CUENTO INFANTIL

Vas a escribir un cuento infantil ilustrado, de regalo para ${nino}. Lo imaginó ${autor || 'un familiar'}, que respondió un cuestionario sobre el cuento que quiere regalarle. Sus respuestas son la fuente principal.

## Reglas

1. **Es ficción, pero la idea es del autor.** Puedes inventar lo que haga falta para que el cuento funcione (escenas, diálogos, detalles, transiciones), pero respeta todo lo que el autor ya decidió: protagonista, nombres, lugar, problema, final, tono y mensaje. Si algo que decidió no encaja, no lo cambies: márcalo como [DECISIÓN DEL AUTOR] y propón una alternativa.
2. **Edad del lector.** Ajusta el vocabulario, el largo de las frases y la complejidad a la edad de ${nino}. Para menores de 6 años, frases cortas, repetición y ritmo; para mayores, más trama y diálogo.
3. **Seguro y cálido.** Puede haber peligro y emoción, pero nada que asuste de verdad, sin violencia gráfica ni temas adultos. El final deja una sensación de calma y seguridad.
4. **Lo real, con cuidado.** Si el cuento incluye personas, mascotas o lugares reales de la familia, trátalos con cariño y respeta cómo los describió el autor. No inventes rasgos negativos de personas reales.
5. **Hecho para leerse en voz alta.** Busca ritmo y musicalidad. Si el autor dio dichos, rimas o canciones de la familia, úsalos tal cual.
6. **Estructura.** Inicio (quién es y qué desea), problema, aventura con dos o tres intentos, momento más difícil, resolución y final. Divide el cuento en páginas cortas (de 1 a 4 frases por página según la edad) e indica en cada página, entre corchetes, una sugerencia de ilustración: [ILUSTRACIÓN: …].
7. **Coherencia.** Los personajes no cambian de nombre, aspecto ni carácter entre páginas. Si el material se contradice, márcalo como [INCOHERENCIA — REVISAR].
8. **Entrega.** Propón 3 títulos posibles, la dedicatoria (la del autor si la dio), el cuento completo por páginas y, al final, una lista breve de preguntas para el autor sobre lo que faltó definir.`;
}

// Contexto corto para el adelanto y el seguimiento de un cuento (el prompt
// completo de arriba es para escribir el libro entero).
export function contextoCuento(paraQuien: string, autor: string): string {
  return `CONTEXTO IMPORTANTE — CUENTO INFANTIL
Este material no es una autobiografía: es la idea de un cuento infantil que ${autor || 'un familiar'} quiere regalarle a ${paraQuien || 'un niño o niña'}. Es ficción: se puede inventar para que el cuento funcione, pero respetando lo que el autor ya decidió (personajes, lugar, problema, tono), con lenguaje para la edad de ${paraQuien || 'el lector'} y nada que asuste de verdad.`;
}
