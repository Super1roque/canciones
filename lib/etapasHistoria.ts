import type { HistoriaData } from './miHistoriaService';

// Única fuente de verdad para las 20 etapas de Mi Historia — vive acá (no en
// components/MiHistoriaApp.tsx, que es 'use client') para que tanto la UI
// como rutas de servidor (ej. la vista previa con IA) puedan usarla sin
// arrastrar código de cliente al bundle del servidor.
export const ETAPAS: { titulo: string; intro?: string; grandes?: boolean; preguntas: string[] }[] = [
  { titulo: 'Datos básicos', preguntas: [
    '¿Cuál es tu nombre completo?', '¿Cómo te llaman normalmente tus familiares y amigos?', '¿Cuándo y dónde naciste?',
    '¿Dónde vives actualmente?', '¿Cómo te describirías brevemente a alguien que nunca te ha conocido?',
    'Si tuvieras que definir tu vida hasta este momento en una sola frase, ¿qué dirías?',
  ]},
  { titulo: 'El lugar donde comenzó todo', preguntas: [
    '¿Cómo era el lugar donde naciste?', '¿Cómo era el barrio, pueblo o ciudad donde creciste?', '¿Cómo era tu casa de la infancia?',
    '¿Quiénes vivían contigo?', '¿Qué sonidos, olores, lugares o escenas recuerdas especialmente de aquella época?',
    '¿Cuál es el recuerdo más antiguo que conservas?', '¿Hay algún lugar de tu infancia al que todavía puedas regresar mentalmente?',
  ]},
  { titulo: 'Mis padres y mi familia', preguntas: [
    '¿Cómo se llamaban tus padres?', '¿Cómo describirías a tu padre?', '¿Cómo describirías a tu madre?',
    '¿Qué aprendiste de tu padre?', '¿Qué aprendiste de tu madre?', '¿Tenías hermanos? ¿Cómo era la relación entre ustedes?',
    '¿Cómo era económicamente la familia?', '¿Qué dificultades tuvieron que enfrentar?',
    '¿Qué costumbre familiar recuerdas con más cariño?', '¿Existe alguna historia familiar que siempre se haya contado?',
  ]},
  { titulo: 'Mi infancia', preguntas: [
    '¿Cómo eras de niño?', '¿Qué juegos practicabas?', '¿Quiénes eran tus mejores amigos?', '¿Cuál fue tu travesura más memorable?',
    '¿Cuál fue tu mayor aventura?', '¿Qué cosas te hacían feliz?', '¿Qué cosas te daban miedo?',
    '¿Hubo algún acontecimiento de tu infancia que te haya marcado?', '¿Qué persona fue especialmente importante durante esos años?',
  ]},
  { titulo: 'La escuela', preguntas: [
    '¿Dónde estudiaste?', '¿Cómo eras como estudiante?', '¿Qué materias te gustaban?', '¿Qué materias no te gustaban?',
    '¿Tuviste algún maestro que haya dejado una huella en ti?', '¿Quiénes fueron tus mejores amigos de escuela?',
    '¿Recuerdas alguna travesura o situación divertida?', '¿Cuál fue uno de los momentos más importantes que viviste en la escuela?',
    '¿Qué soñabas ser cuando fueras adulto?',
  ]},
  { titulo: 'La adolescencia', preguntas: [
    '¿Cómo cambiaste al entrar en la adolescencia?', '¿Cómo era tu relación con tus padres en esa etapa?', '¿Quiénes eran tus amigos?',
    '¿Qué música escuchabas?', '¿Qué deportes o actividades practicabas?', '¿Tuviste algún amor importante?',
    '¿Cuál fue tu primera gran rebeldía?', '¿Cuál fue la aventura más memorable de tu adolescencia?',
    '¿Qué sueño tenías en aquella época?', '¿Qué decisión tomada durante tu adolescencia influyó posteriormente en tu vida?',
  ]},
  { titulo: 'Cuando tuve que crecer', preguntas: [
    '¿Cuándo sentiste que realmente habías dejado de ser niño?', '¿Cuál fue tu primer trabajo?', '¿Cómo conseguiste ese trabajo?',
    '¿Cómo te sentiste al recibir tu primer sueldo?', '¿En qué gastaste tu primer sueldo?', '¿Cuál fue el trabajo más difícil que tuviste?',
    '¿Qué persona te ayudó en tus primeros años de vida adulta?', '¿Cuál fue tu primer gran logro como adulto?', '¿Cuál fue tu primer gran fracaso?',
  ]},
  { titulo: 'El amor', preguntas: [
    '¿Quién fue tu primer amor importante?', '¿Cómo conociste a la persona que marcó tu vida sentimental?', '¿Cuál fue tu primera impresión de ella?',
    '¿Cuál fue el momento en que supiste que era alguien especial?', '¿Cómo comenzó la relación?', '¿Cuál fue el momento más bonito que vivieron juntos?',
    '¿Cuál fue la dificultad más grande que enfrentaron?', '¿Qué has aprendido sobre el amor a través de los años?',
  ]},
  { titulo: 'Convertirse en padre/madre', preguntas: [
    '¿Tienes hijos? ¿Cuántos?', '¿Qué sentiste cuando supiste que ibas a ser padre/madre?', '¿Cómo recuerdas el nacimiento o llegada de cada hijo?',
    '¿Cómo eran tus hijos cuando eran pequeños?', '¿Cuál es una anécdota inolvidable con cada uno?',
    '¿Cuál ha sido el momento relacionado con tus hijos que más orgullo te ha producido?', '¿Qué ha sido lo más difícil de ser padre/madre?', '¿Qué te han enseñado tus hijos?',
  ]},
  { titulo: 'Mi vida profesional', preguntas: [
    '¿Cuál ha sido tu trayectoria laboral?', '¿Cuál fue tu primer trabajo importante?', '¿Qué trabajo disfrutaste más?', '¿Cuál fue el más difícil?',
    '¿Quiénes fueron tus principales mentores?', '¿Cuál fue tu mayor logro profesional?', '¿Cuál fue tu mayor fracaso profesional?',
    '¿Alguna vez tuviste que empezar de cero?', '¿Qué aprendiste trabajando?', '¿Qué significa para ti el éxito profesional?',
  ]},
  { titulo: 'El momento más difícil', preguntas: [
    '¿Cuál ha sido la etapa más difícil de tu vida?', '¿Qué ocurrió?', '¿Qué sentiste en ese momento?', '¿Quién estaba contigo?',
    '¿Qué fue lo que más miedo te produjo?', '¿Llegaste a pensar que no podrías superarlo?', '¿Qué hiciste para salir adelante?',
    '¿Qué cambió en ti después de esa experiencia?', '¿Qué aprendiste que jamás olvidarás?',
  ]},
  { titulo: 'El momento más feliz', preguntas: [
    '¿Cuál ha sido el día más feliz de tu vida?', '¿Dónde estabas?', '¿Quién estaba contigo?', '¿Qué ocurrió?', '¿Qué sentiste?',
    '¿Hay alguna fotografía de ese momento?', 'Si pudieras volver a vivir un solo día de tu vida, ¿sería ese?',
  ]},
  { titulo: 'Mis grandes aventuras', preguntas: [
    '¿Cuál ha sido el viaje más memorable de tu vida?', '¿Cuál ha sido tu aventura más grande?', '¿Alguna vez hiciste algo que parecía imposible?',
    '¿Cuál ha sido la situación más divertida que has vivido?', '¿Cuál ha sido tu mayor susto?', '¿Has vivido alguna situación absurda o increíble que todavía recuerdes?',
    '¿Qué experiencia repetirías inmediatamente?', '¿Qué experiencia jamás volverías a repetir?',
  ]},
  { titulo: 'Las personas que dejaron huella', intro: 'Antes de estas preguntas, te invitamos a agregar fichas de las personas más importantes de tu vida en el módulo "Personas de mi historia" (arriba). Acá reflexionemos un poco más sobre ellas:', preguntas: [
    '¿Quién fue tu mayor inspiración?', '¿Quién te ayudó cuando más lo necesitabas?', '¿Quién te enseñó una gran lección?',
    '¿Quién te hizo daño pero terminó enseñándote algo?', '¿A quién le debes un agradecimiento?', '¿A quién te gustaría pedirle perdón?',
  ]},
  { titulo: 'Mis errores y fracasos', preguntas: [
    '¿Cuál ha sido el mayor error que has cometido?', '¿Qué decisión equivocada tomaste?', '¿Qué fracaso te dolió más?',
    '¿Qué aprendiste de ese fracaso?', 'Si pudieras regresar al pasado, ¿qué cambiarías?', '¿Hay algún error que, aunque fue doloroso, terminó ayudándote?',
    '¿Qué consejo le darías a alguien para que no cometa el mismo error?',
  ]},
  { titulo: 'Mis sueños y logros', preguntas: [
    '¿Cuál fue tu mayor sueño cuando eras joven?', '¿Cuáles de tus sueños has conseguido?', '¿Cuál fue el logro que más trabajo te costó?',
    '¿Cuál te produjo mayor satisfacción?', '¿Quiénes te ayudaron a conseguirlo?', '¿Qué sueño todavía tienes pendiente?',
    '¿Hay algo que todavía quieras demostrarte a ti mismo?',
  ]},
  { titulo: 'Secretos y anécdotas', grandes: true, preguntas: [
    '¿Cuál es una historia de tu vida que casi nadie conoce?', '¿Cuál ha sido tu mayor locura?', '¿Cuál ha sido tu momento más vergonzoso?',
    '¿Alguna vez hiciste algo que hoy te causa risa?', '¿Alguna vez estuviste en el lugar equivocado en el momento equivocado?',
    '¿Cuál es la historia que tus amigos siempre cuentan sobre ti?', '¿Hay algo que siempre quisiste contar pero nunca habías tenido la oportunidad?',
  ]},
  { titulo: 'La persona que soy hoy', preguntas: [
    '¿Cómo te describirías actualmente?', '¿Cuáles consideras que son tus mejores cualidades?', '¿Cuál es tu mayor defecto?',
    '¿Qué cosas te hacen feliz actualmente?', '¿Qué cosas te hacen enojar?', '¿Qué cosas valoras más en una persona?',
    '¿Qué cosas ya no toleras?', '¿Qué ha cambiado en tu personalidad con los años?', '¿Qué parte de ti sigue exactamente igual que cuando eras joven?',
  ]},
  { titulo: 'Mirando hacia atrás', preguntas: [
    '¿Qué harías exactamente igual si pudieras volver a vivir tu vida?', '¿Qué cambiarías?', '¿Qué persona te hubiera gustado conocer antes?',
    '¿Qué consejo le darías a tu yo de 15 años?', '¿Qué consejo le darías a tu yo de 25 años?', '¿Qué has aprendido sobre el amor?',
    '¿Qué has aprendido sobre la familia?', '¿Qué has aprendido sobre el dinero?', '¿Qué has aprendido sobre el fracaso?',
    '¿Qué has aprendido sobre la felicidad?', '¿Qué has aprendido sobre el paso del tiempo?',
  ]},
  { titulo: 'Mi legado', preguntas: [
    '¿Cómo te gustaría que te recordaran?', '¿Qué quieres que tus hijos recuerden de ti?', '¿Qué quieres que tus nietos recuerden de ti?',
    '¿Qué enseñanza quieres dejar a tu familia?', '¿Qué enseñanza quieres dejar a las próximas generaciones?', '¿Hay alguien a quien quieras dedicar unas últimas palabras?',
    'Si pudieras escribir una carta a toda tu familia, ¿qué dirías?', 'Si tu vida pudiera resumirse en una sola frase, ¿cuál sería?',
    '¿Qué título le pondrías tú a tu propia historia?', '¿Qué te gustaría que el lector sintiera después de terminar este libro?',
  ]},
];

export function claveResp(e: number, p: number): string { return 'e' + e + '_p' + p; }

// Texto plano con lo que la persona ya respondió — mismo criterio que
// construirTexto() en MiHistoriaApp.tsx, pero reducido a solo preguntas
// con respuesta real (sin encabezados de etapas vacías) y sin el resto del
// material (fotos, personas, línea de tiempo), pensado para pedidos cortos
// como la vista previa con IA, no para la exportación completa.
export function construirMaterialRespondido(historia: HistoriaData): string {
  let out = '';
  ETAPAS.forEach((etapa, ei) => {
    const preguntasRespondidas = etapa.preguntas
      .map((preg, pi) => ({ preg, r: historia.respuestas[claveResp(ei, pi)] }))
      .filter(({ r }) => r && r.texto && r.texto.trim());
    if (preguntasRespondidas.length === 0) return;
    out += 'ETAPA ' + (ei + 1) + ' — ' + etapa.titulo.toUpperCase() + '\n';
    preguntasRespondidas.forEach(({ preg, r }) => {
      out += 'Pregunta: ' + preg + '\nRespuesta: ' + r.texto.trim() + '\n';
      r.profundizaciones.forEach(f => { if (f.respuesta.trim()) out += '  · ' + f.pregunta + ' → ' + f.respuesta + '\n'; });
    });
    out += '\n';
  });
  return out.trim();
}
