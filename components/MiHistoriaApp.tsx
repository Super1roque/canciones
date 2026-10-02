'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

// Google Fonts por <link> normal, no next/font/google — ese loader exige
// que cada llamada tenga un único call site fijo en el árbol de módulos, y
// se rompe (Turbopack: "next/font/google queries have exactly one entry")
// cuando el mismo componente lo importan dos páginas distintas, que es
// justo el caso acá (app/admin/mi-historia y app/historia/[clave]).
const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600;700&family=Karla:wght@400;500;600;700;800&display=swap';

// =============================================================================
// MI HISTORIA — Constructor de Biografías
// Migrado desde un Artifact standalone: mismo diseño y lógica, pero persiste
// en Firestore/Storage (vía /api/historia/[clave]/*) en vez de localStorage,
// así sincroniza entre cualquier dispositivo. Un mismo componente sirve
// tanto al admin (app/admin/mi-historia, clave fija 'principal') como a
// cualquier tenant al que se le dé un link (app/historia/[clave], clave =
// token random de ese link) — ver lib/historiaLinksService.ts.
// =============================================================================

// Prompt de referencia (no se usa todavía en la app — se pega a mano en otra
// conversación de IA cuando llegue el momento de redactar el libro). Pegado
// tal cual lo mandó el usuario.
const PROMPT_MAESTRO = `# PROMPT MAESTRO PARA ESCRIBIR MI BIOGRAFÍA

## 1. TU PAPEL

Actúa como un **escritor profesional de biografías, cronista y narrador literario**, especializado en transformar testimonios personales en historias humanas, emotivas y auténticas.

Vas a recibir un conjunto de materiales autobiográficos proporcionados directamente por el protagonista.

Tu trabajo NO consiste en resumir esos materiales.

Tu trabajo consiste en **convertirlos en un libro biográfico completo**, utilizando la información proporcionada como fuente primaria y respetando estrictamente la verdad de los acontecimientos.

La historia debe sentirse como la vida de una persona real: con lugares, recuerdos, decisiones, dificultades, emociones, personas importantes, pequeñas escenas y momentos que permitan al lector imaginar que estuvo allí.

---

# 2. REGLA PRINCIPAL: LA VERDAD ES LA FUENTE PRIMARIA

Todo lo proporcionado por el protagonista debe considerarse **fuente primaria de la historia**.

### NUNCA:

* Inventes acontecimientos.
* Inventes personas.
* Inventes fechas.
* Inventes lugares.
* Inventes conversaciones que nunca fueron proporcionadas.
* Inventes sentimientos que el protagonista nunca expresó.
* Inventes causas de acontecimientos.
* Cambies nombres.
* Cambies edades.
* Cambies relaciones familiares.
* Cambies lugares.
* Cambies fechas.
* Agregues logros que no aparecen en el material.
* Conviertas una suposición en un hecho.
* Presentes como cierto algo que el protagonista dijo que no recuerda.

### SI FALTA INFORMACIÓN:

No rellenes el vacío con imaginación.

Si el dato es necesario para comprender correctamente una parte importante de la historia, escribe:

**[ACLARACIÓN NECESARIA: explicar...]**

o formula una pregunta concreta al protagonista antes de continuar.

Si el dato no es indispensable, continúa la narración sin inventarlo.

---

# 3. PUEDES HACER LITERATURA, PERO NO PUEDES INVENTAR LA HISTORIA

Debes distinguir entre:

### HECHO

Lo que realmente ocurrió según el material proporcionado.

### NARRACIÓN

La forma literaria de contar ese hecho.

### ESCENA

La reconstrucción narrativa de un momento cuando existen suficientes datos para hacerlo.

### REFLEXIÓN

Una interpretación basada directamente en lo que el protagonista expresó.

Puedes mejorar enormemente la forma de contar una experiencia, pero **no puedes agregar hechos para hacerla más dramática**.

Ejemplo:

Si el protagonista dice:

"Vivíamos frente a un campo de fútbol y desde la casa se podían ver los partidos."

Puedes convertirlo en:

> Frente a la casa había un campo de fútbol polvoriento. Desde cualquiera de aquellos espacios familiares se podía ver cómo los equipos se disputaban los partidos de los fines de semana. Los gritos, los silbidos y las celebraciones formaban parte del paisaje cotidiano.

Eso es una transformación literaria válida.

Pero no puedes escribir:

> "Armando bajaba todos los domingos al campo para jugar con sus amigos."

si él nunca dijo que eso ocurría.

---

# 4. CONSERVA LAS FRASES IMPORTANTES DEL PROTAGONISTA

Cuando el protagonista utiliza una frase especialmente poderosa, auténtica o representativa de su personalidad, debes conservarla.

Ejemplos:

> "He tenido que inventar mi futuro día con día."

> "Fui el que rompió el molde en mi familia."

Estas frases pueden convertirse en:

* frases destacadas;
* títulos de capítulos;
* inicio de capítulos;
* cierre de capítulos;
* reflexiones;
* elementos centrales de la narrativa.

No las sustituyas innecesariamente por frases literarias inventadas.

La voz del protagonista debe permanecer presente dentro del libro.

---

# 5. IDENTIFICA EL MATERIAL NARRATIVO DESTACADO

Mientras analizas el material, identifica internamente:

### MATERIAL NARRATIVO DESTACADO

Incluye:

* recuerdos especialmente visuales;
* momentos difíciles;
* decisiones importantes;
* cambios de vida;
* primeras veces;
* pérdidas;
* triunfos;
* fracasos;
* aventuras;
* personas que dejaron huella;
* frases memorables;
* contradicciones;
* momentos de miedo;
* momentos de felicidad;
* escenas familiares;
* lugares importantes;
* objetos asociados a recuerdos;
* olores;
* sonidos;
* imágenes;
* costumbres;
* pequeñas anécdotas que revelen la personalidad.

Estos elementos deben recibir especial atención durante la escritura.

---

# 6. TRANSFORMA LOS DATOS EN ESCENAS

No escribas toda la biografía como una lista de acontecimientos.

Cuando exista suficiente información, convierte los acontecimientos en escenas.

Una buena escena puede incluir:

* dónde ocurrió;
* cuándo ocurrió;
* quién estaba presente;
* qué estaba pasando;
* qué recuerda el protagonista;
* qué objetos o lugares aparecen;
* qué sonidos existían;
* qué importancia tuvo posteriormente.

Utiliza detalles sensoriales únicamente cuando estén respaldados por el material.

Si el protagonista recuerda:

* polvo;
* buses;
* gritos;
* silbidos;
* una camioneta Willys roja;
* un campo de fútbol;

utiliza esos elementos para construir la atmósfera.

No agregues elementos sensoriales que nunca fueron mencionados si podrían convertirse en hechos falsos.

---

# 7. NO CONVIERTAS LA BIOGRAFÍA EN UNA ENTREVISTA

El resultado final NO debe parecer:

"Pregunta: ¿Dónde naciste?"

"Respuesta: Nací en Tegucigalpa."

Debe convertirse en una narración continua.

La información de las respuestas debe integrarse naturalmente en la historia.

---

# 8. ESTRUCTURA DEL LIBRO

Construye aproximadamente entre 15 y 20 capítulos, dependiendo de la cantidad y riqueza del material.

La estructura sugerida es:

## PRÓLOGO

Presenta al protagonista y plantea la pregunta central de su vida.

## CAPÍTULO 1 — EL LUGAR DONDE COMENZÓ TODO

Nacimiento, primeros lugares, familia, barrio y primeros recuerdos.

## CAPÍTULO 2 — LA FAMILIA QUE ME FORMÓ

Padres, hermanos, ambiente familiar, valores y enseñanzas.

## CAPÍTULO 3 — JUEGOS, TRAVESURAS Y SUEÑOS

Infancia, juegos, amigos, aventuras y primeras ilusiones.

## CAPÍTULO 4 — EL NIÑO COMIENZA A DESCUBRIR EL MUNDO

Escuela, maestros, amistades, descubrimientos y personalidad.

## CAPÍTULO 5 — CUANDO LLEGÓ LA ADOLESCENCIA

Cambios, inquietudes, amistades, decisiones y primeros desafíos.

## CAPÍTULO 6 — EL MOMENTO DE TOMAR LAS RIENDAS

Primeras decisiones importantes y comienzo de la vida adulta.

## CAPÍTULO 7 — EL AMOR QUE CAMBIÓ MI HISTORIA

Pareja, enamoramiento, matrimonio o relaciones significativas.

## CAPÍTULO 8 — LOS HIJOS Y UNA NUEVA RESPONSABILIDAD

Paternidad/maternidad, crianza y transformación personal.

## CAPÍTULO 9 — EL TRABAJO, LOS SUEÑOS Y LAS BATALLAS

Vida profesional, proyectos, emprendimientos, esfuerzos y aspiraciones.

## CAPÍTULO 10 — CUANDO LA VIDA NO SALIÓ COMO ESPERABA

Fracasos, dificultades, decepciones y momentos inesperados.

## CAPÍTULO 11 — EL GOLPE QUE ME CAMBIÓ

El acontecimiento o etapa que produjo una transformación profunda.

## CAPÍTULO 12 — LAS PERSONAS QUE DEJARON HUELLA

Personas importantes y lo que significaron.

## CAPÍTULO 13 — LA SEGUNDA OPORTUNIDAD

Cambios, recuperación, nuevos comienzos y decisiones.

## CAPÍTULO 14 — LOS SUEÑOS QUE SÍ SE HICIERON REALIDAD

Logros, metas alcanzadas y momentos de satisfacción.

## CAPÍTULO 15 — LOS SUEÑOS QUE TODAVÍA ME FALTAN

Lo que todavía desea conseguir o experimentar.

## CAPÍTULO 16 — SI PUDIERA VOLVER ATRÁS

Reflexiones sobre decisiones, errores y aprendizajes.

## CAPÍTULO 17 — LO QUE APRENDÍ DE LA VIDA

Las principales enseñanzas obtenidas de toda la experiencia.

## CAPÍTULO 18 — LO QUE DEJO DETRÁS DE MÍ

Familia, valores, obras, enseñanzas e influencia.

## CAPÍTULO 19 — UNA CARTA PARA LOS QUE AMO

Una carta personal escrita desde la perspectiva del protagonista.

## EPÍLOGO — LA HISTORIA CONTINÚA

Cierre emocional dejando claro que la vida del protagonista no termina con el libro.

### IMPORTANTE

Esta estructura es una guía, no una camisa de fuerza.

Si el material revela una historia más interesante, reorganiza los capítulos para servir mejor a la narrativa.

No fuerces acontecimientos dentro de capítulos donde no corresponden.

---

# 9. EL LIBRO DEBE TENER UNA HISTORIA CENTRAL

Después de analizar todo el material, identifica cuál parece ser el gran hilo conductor de la vida del protagonista.

Puede ser, por ejemplo:

* superar dificultades;
* construir una vida desde cero;
* romper con las expectativas familiares;
* buscar libertad;
* luchar por la familia;
* reinventarse;
* perseguir sueños;
* aprender de los errores;
* comenzar nuevamente;
* dejar un legado.

No inventes este hilo conductor.

Debe surgir de las propias respuestas del protagonista.

Utilízalo como hilo invisible que conecte todo el libro.

---

# 10. EVITA UNA BIOGRAFÍA ABURRIDA

No conviertas el libro en:

"En 1975 pasó esto. En 1976 pasó esto. En 1977 pasó esto."

Utiliza una combinación de:

* cronología;
* escenas;
* recuerdos;
* reflexiones;
* diálogos únicamente cuando hayan sido proporcionados;
* frases del protagonista;
* contexto;
* fotografías;
* momentos decisivos.

El lector debe sentir que está recorriendo una vida, no leyendo una base de datos.

---

# 11. RITMO NARRATIVO

Alterna:

### ESCENAS

Momentos concretos de la vida.

### REFLEXIONES

Lo que esos acontecimientos significaron.

### ANÉCDOTAS

Historias pequeñas pero memorables.

### TRANSICIONES

Conecta una etapa con otra.

### FRASES DESTACADAS

Frases auténticas del protagonista.

Evita que todos los capítulos tengan exactamente la misma estructura.

---

# 12. FOTOGRAFÍAS

Cuando el material incluya fotografías o existan momentos que podrían ilustrarse, agrega:

**[SUGERENCIA DE FOTOGRAFÍA]**

Ejemplo:

> [SUGERENCIA DE FOTOGRAFÍA: Fotografía de la infancia del protagonista frente a la casa familiar en la colonia San Miguel.]

Las sugerencias deben basarse en acontecimientos reales.

No inventes fotografías existentes.

También puedes sugerir:

* fotografía familiar;
* fotografía del lugar;
* fotografía de documentos;
* fotografía de objetos importantes;
* fotografía de personas;
* fotografía de momentos especiales.

---

# 13. FRASES DESTACADAS

Al final de cada capítulo identifica una frase que tenga fuerza narrativa.

Prioridad:

1. Frase real del protagonista.
2. Frase tomada literalmente de sus respuestas.
3. Una frase narrativa creada por la IA solamente cuando sea claramente una reflexión derivada de los hechos y no se presente como una cita del protagonista.

Las citas reales deben identificarse como tales.

Nunca atribuyas al protagonista una frase que él no dijo.

---

# 14. PERSONAS IMPORTANTES

Cuando aparezca una persona significativa, explica naturalmente:

* quién era;
* qué relación tenía con el protagonista;
* cómo apareció en su vida;
* qué ocurrió entre ellos;
* qué enseñanza dejó;
* por qué fue importante.

No conviertas esto en fichas biográficas.

Integra a las personas dentro de la historia.

---

# 15. CONTRADICCIONES

Si encuentras dos datos aparentemente contradictorios:

NO elijas uno arbitrariamente.

NO corrijas silenciosamente al protagonista.

Marca:

**[POSIBLE CONTRADICCIÓN — REVISAR]**

y explica brevemente qué información necesita confirmación.

Ejemplo:

> [POSIBLE CONTRADICCIÓN — REVISAR: en una respuesta se indica que el acontecimiento ocurrió en 1978 y en otra en 1979.]

---

# 16. INFORMACIÓN INCOMPLETA

Cuando una historia parece importante pero falta información, utiliza:

**[FALTA PROFUNDIZAR]**

seguido de una pregunta concreta.

Ejemplo:

> [FALTA PROFUNDIZAR: ¿Qué sentiste en ese momento y qué decisión tomaste después?]

Esto permitirá realizar una segunda entrevista.

---

# 17. VOZ DEL PROTAGONISTA

La narración debe estar escrita preferentemente en **primera persona**, como si el protagonista estuviera contando su propia vida.

Debe sonar:

* humana;
* cercana;
* sincera;
* reflexiva;
* natural;
* emocional sin exageraciones;
* adulta;
* auténtica.

No utilices un lenguaje excesivamente académico.

No conviertas al protagonista en un héroe perfecto.

Una buena autobiografía también muestra:

* errores;
* dudas;
* contradicciones;
* fracasos;
* decisiones equivocadas;
* momentos difíciles;
* aprendizajes.

---

# 18. NO IDEALICES AL PROTAGONISTA

El objetivo no es construir una persona perfecta.

El objetivo es mostrar una persona real.

Cuando existan errores reconocidos por el protagonista, deben formar parte de la historia de manera respetuosa.

Cuando existan conflictos familiares o personales, no los exageres.

No conviertas a otras personas en villanos sin evidencia.

---

# 19. INTRODUCE CONTEXTO SIN INVENTAR

Cuando sea necesario explicar un contexto histórico, social o geográfico, puedes hacerlo únicamente si:

* está confirmado por el material;
* o posteriormente se proporciona información adicional confiable.

No atribuyas causas históricas específicas a acontecimientos personales sin fundamento.

La vida del protagonista es el centro de la historia.

---

# 20. TÍTULO Y SUBTÍTULO

Después de analizar todo el material, propón entre **5 y 10 posibles títulos**.

Los títulos deben surgir de:

* frases del protagonista;
* momentos decisivos;
* lugares;
* valores;
* conflictos;
* sueños;
* filosofía de vida.

Después selecciona un título principal para el libro.

El título debe sentirse personal y auténtico, no genérico.

---

# 21. DEDICATORIA

Escribe una dedicatoria basada en las personas y valores realmente importantes para el protagonista.

No inventes nombres ni relaciones.

---

# 22. PRÓLOGO

El prólogo debe responder implícitamente:

**¿Por qué vale la pena contar esta vida?**

No debe ser una repetición del capítulo 1.

Debe presentar el espíritu de la historia y despertar interés por conocer el camino recorrido.

---

# 23. EPÍLOGO

El epílogo debe mirar hacia adelante.

Debe mostrar:

* quién es hoy el protagonista;
* qué ha aprendido;
* qué sigue soñando;
* qué desea dejar a los demás;
* qué significa para él haber recorrido ese camino.

No escribas que su historia terminó.

La idea es:

**La historia continúa.**

---

# 24. LEGADO

Construye una sección final llamada:

## MI LEGADO

Debe responder:

* ¿Qué quiere dejar a sus hijos?
* ¿Qué quiere enseñar a su familia?
* ¿Qué valores quiere transmitir?
* ¿Cómo quiere ser recordado?
* ¿Qué aprendió que pueda servir a otros?

Utiliza exclusivamente información proporcionada por el protagonista.

---

# 25. FORMATO FINAL DEL LIBRO

La salida final debe seguir aproximadamente este formato:

# TÍTULO

## SUBTÍTULO

### DEDICATORIA

### PRÓLOGO

---

# CAPÍTULO 1

## Título

Narración...

**Frase destacada:**

> "..."

**[SUGERENCIA DE FOTOGRAFÍA]**

---

# CAPÍTULO 2

## Título

Narración...

Y así sucesivamente.

Al final:

### EPÍLOGO

### MI LEGADO

### CRONOLOGÍA DE MI VIDA

### PERSONAS IMPORTANTES

### ÁLBUM DE RECUERDOS

---

# 26. CRONOLOGÍA

Al finalizar el libro, crea una cronología basada exclusivamente en fechas y acontecimientos confirmados.

Formato:

**AÑO / EDAD — ACONTECIMIENTO — LUGAR**

Si la fecha no está confirmada, indícalo como:

**[FECHA POR CONFIRMAR]**

---

# 27. CONTROL DE CALIDAD ANTES DE ENTREGAR EL LIBRO

Antes de presentar el resultado final, revisa internamente:

### VERIFICACIÓN DE HECHOS

* ¿Inventé algún acontecimiento?
* ¿Inventé algún diálogo?
* ¿Inventé alguna persona?
* ¿Cambió algún nombre?
* ¿Cambió alguna fecha?
* ¿Agregué información no proporcionada?

### VERIFICACIÓN DE NARRATIVA

* ¿La historia fluye?
* ¿Los capítulos tienen sentido?
* ¿Existen escenas memorables?
* ¿La historia tiene un hilo conductor?
* ¿La voz del protagonista se mantiene?

### VERIFICACIÓN EMOCIONAL

* ¿La emoción proviene de los hechos reales?
* ¿Evité exagerar?
* ¿El protagonista se siente humano?

### VERIFICACIÓN DE FUENTE

* ¿Las frases entre comillas fueron realmente dichas?
* ¿Las reflexiones están claramente separadas de las citas?
* ¿Las partes que necesitan confirmación están marcadas?

---

# 28. MUY IMPORTANTE: NO TERMINES EL LIBRO SI FALTA INFORMACIÓN ESENCIAL

Si después de analizar el material consideras que existen vacíos importantes que impiden escribir una parte fundamental de la historia, NO inventes.

Primero presenta una sección:

# INFORMACIÓN QUE NECESITO ANTES DE CONTINUAR

Y formula únicamente las preguntas necesarias.

Las preguntas deben ser concretas y fáciles de responder.

No vuelvas a preguntar cosas que ya están en el material.

---

# 29. SEGUNDA PASADA DE EDICIÓN

Una vez que el primer manuscrito esté terminado, realiza una segunda revisión.

En esta revisión:

* elimina repeticiones;
* mejora transiciones;
* fortalece comienzos y finales de capítulos;
* identifica capítulos demasiado débiles;
* identifica historias que podrían desarrollarse más;
* conserva las frases auténticas;
* verifica nombres y fechas;
* mejora el ritmo;
* evita lenguaje artificial;
* evita clichés;
* evita exageraciones.

No agregues hechos nuevos durante esta edición.

---

# 30. PRINCIPIO FINAL

Recuerda siempre:

**No estás escribiendo una novela sobre una persona.**

**Estás convirtiendo la vida real de una persona en una historia que pueda ser leída como un libro.**

La creatividad debe utilizarse para **contar mejor la verdad**, nunca para reemplazarla.

La voz, los recuerdos, las decisiones, los errores, las personas, los lugares y las experiencias del protagonista son el corazón del libro.

Tu objetivo final es que, al terminar de leerlo, alguien que nunca conoció al protagonista pueda decir:

**"Ahora siento que conozco su historia."**`;

type EstadoPregunta = 'sin_responder' | 'respondida' | 'necesita_profundizacion' | 'completada' | 'no_responder' | 'no_recuerdo';
type Respuesta = { texto: string; estado: EstadoPregunta; volverDespues: boolean; profundizaciones: { pregunta: string; respuesta: string }[] };
type Persona = {
  id: string; nombre: string; apodo: string; relacion: string; nacimiento: string; fallecimiento: string;
  comoConoci: string; significado: string; aprendi: string; recuerdos: string; diria: string;
};
type Foto = {
  id: string; descripcion: string; año: string; lugar: string; personas: string;
  queOcurria: string; porQueImportante: string; etapaRelacionada: string;
};
type Evento = {
  id: string; fecha: string; edad: string; acontecimiento: string; lugar: string; personas: string;
  descripcion: string; importancia: string;
};
type Contradiccion = { id: string; nota: string };
type Pantalla = 'home' | 'interview' | 'stageEnd' | 'people' | 'photos' | 'timeline' | 'review' | 'final' | 'prompt';

type HistoriaData = {
  meta: { creado: string; actualizado: string };
  respuestas: Record<string, Respuesta>;
  notasLibres: { id: string; etapaIdx: number; texto: string; fecha: string }[];
  personas: Persona[];
  fotografias: Foto[];
  lineaDeTiempo: Evento[];
  contradicciones: Contradiccion[];
  progreso?: { etapaActual: number; preguntaActual: number };
};

function historiaVacia(): HistoriaData {
  const ahora = new Date().toISOString();
  return { meta: { creado: ahora, actualizado: ahora }, respuestas: {}, notasLibres: [], personas: [], fotografias: [], lineaDeTiempo: [], contradicciones: [] };
}

const ETAPAS: { titulo: string; intro?: string; grandes?: boolean; preguntas: string[] }[] = [
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

function claveResp(e: number, p: number) { return 'e' + e + '_p' + p; }
function totalPreguntas() { return ETAPAS.reduce((acc, e) => acc + e.preguntas.length, 0); }

// clave identifica DE QUIÉN es esta historia en Firestore/Storage — 'principal'
// para el admin (ver app/admin/mi-historia/page.tsx), o el token del link
// cuando la abre un tenant (ver app/historia/[clave]/page.tsx). El resto del
// componente es idéntico para ambos casos, ni se entera de la diferencia.
export default function MiHistoriaApp({ clave }: { clave: string }) {
  const [historiaState, setHistoria] = useState<HistoriaData | null>(null);
  const [nombre, setNombre] = useState('');
  const [cargando, setCargando] = useState(true);
  const [pantalla, setPantalla] = useState<Pantalla>('home');
  const [etapaActual, setEtapaActual] = useState(0);
  const [preguntaActual, setPreguntaActual] = useState(0);
  const [toast, setToast] = useState('');
  const [pidiendoProfundizacion, setPidiendoProfundizacion] = useState(false);
  const guardarTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/historia/' + clave).then(r => r.json()).then(data => {
      const { nombre: nombreRecibido, ...resto } = data;
      const h: HistoriaData = Object.assign(historiaVacia(), resto);
      setHistoria(h);
      setNombre(nombreRecibido || '');
      if (h.progreso) { setEtapaActual(h.progreso.etapaActual); setPreguntaActual(h.progreso.preguntaActual); }
      setCargando(false);
    }).catch(() => { setHistoria(historiaVacia()); setCargando(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function mostrarToast(msg: string) {
    setToast(msg);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(''), 2200);
  }

  const guardar = useCallback((data: HistoriaData, inmediato?: boolean) => {
    const hacer = () => {
      fetch('/api/historia/' + clave, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      }).catch(() => mostrarToast('No se pudo guardar — revisá tu conexión.'));
    };
    if (guardarTimeout.current) clearTimeout(guardarTimeout.current);
    if (inmediato) { hacer(); return; }
    guardarTimeout.current = setTimeout(hacer, 500);
  }, [clave]);

  function actualizar(mutar: (h: HistoriaData) => void, inmediato?: boolean) {
    setHistoria(prev => {
      if (!prev) return prev;
      const next: HistoriaData = JSON.parse(JSON.stringify(prev));
      mutar(next);
      next.progreso = { etapaActual, preguntaActual };
      guardar(next, inmediato);
      return next;
    });
  }

  function getResp(h: HistoriaData, e: number, p: number): Respuesta {
    const k = claveResp(e, p);
    return h.respuestas[k] || { texto: '', estado: 'sin_responder', volverDespues: false, profundizaciones: [] };
  }

  if (cargando || !historiaState) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf4e9', color: '#6b5d4a', fontFamily: 'sans-serif' }}>Cargando tu historia...</div>;
  }
  // Narrowing explícito — TS no propaga el chequeo de arriba dentro de los
  // closures definidos más abajo si siguen leyendo `historiaState`.
  const historia: HistoriaData = historiaState;

  function contarRespondidas(h: HistoriaData) {
    let n = 0;
    for (const k in h.respuestas) if (h.respuestas[k].estado !== 'sin_responder') n++;
    return n;
  }
  function etapaCompleta(h: HistoriaData, idx: number) {
    for (let p = 0; p < ETAPAS[idx].preguntas.length; p++) if (getResp(h, idx, p).estado === 'sin_responder') return false;
    return true;
  }

  function irA(p: Pantalla, extra?: { etapaActual?: number; preguntaActual?: number }) {
    if (extra?.etapaActual !== undefined) setEtapaActual(extra.etapaActual);
    if (extra?.preguntaActual !== undefined) setPreguntaActual(extra.preguntaActual);
    setPantalla(p);
    window.scrollTo({ top: 0 });
  }

  function empezar() { setEtapaActual(0); setPreguntaActual(0); irA('interview'); }

  // -------- Entrevista --------
  function ActualizarRespuestaTexto(texto: string) {
    actualizar(h => {
      const k = claveResp(etapaActual, preguntaActual);
      const r = h.respuestas[k] || { texto: '', estado: 'sin_responder', volverDespues: false, profundizaciones: [] };
      r.texto = texto;
      if (r.estado !== 'no_responder' && r.estado !== 'no_recuerdo') {
        r.estado = texto.trim() ? (r.estado === 'necesita_profundizacion' ? 'necesita_profundizacion' : 'respondida') : 'sin_responder';
      }
      h.respuestas[k] = r;
    });
  }
  function marcarEstadoEspecial(tipo: EstadoPregunta) {
    actualizar(h => {
      const k = claveResp(etapaActual, preguntaActual);
      const r = h.respuestas[k] || { texto: '', estado: 'sin_responder', volverDespues: false, profundizaciones: [] };
      r.estado = r.estado === tipo ? (r.texto.trim() ? 'respondida' : 'sin_responder') : tipo;
      h.respuestas[k] = r;
    }, true);
  }
  function toggleVolverDespues() {
    actualizar(h => {
      const k = claveResp(etapaActual, preguntaActual);
      const r = h.respuestas[k] || { texto: '', estado: 'sin_responder', volverDespues: false, profundizaciones: [] };
      r.volverDespues = !r.volverDespues;
      h.respuestas[k] = r;
    }, true);
  }
  function actualizarFollowup(fi: number, texto: string) {
    actualizar(h => {
      const k = claveResp(etapaActual, preguntaActual);
      const r = h.respuestas[k];
      if (r && r.profundizaciones[fi]) r.profundizaciones[fi].respuesta = texto;
    });
  }
  async function pedirProfundizacion() {
    const resp = getResp(historia, etapaActual, preguntaActual);
    const pregunta = ETAPAS[etapaActual].preguntas[preguntaActual];
    setPidiendoProfundizacion(true);
    try {
      const res = await fetch('/api/historia/profundizar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta, respuesta: resp.texto }),
      });
      const data = await res.json();
      if (!res.ok) { mostrarToast(data.error || 'No se pudieron generar preguntas'); return; }
      actualizar(h => {
        const k = claveResp(etapaActual, preguntaActual);
        const r = h.respuestas[k];
        r.profundizaciones = data.preguntas.map((p: string) => ({ pregunta: p, respuesta: '' }));
        r.estado = 'necesita_profundizacion';
      }, true);
    } catch {
      mostrarToast('No se pudo pedir más preguntas ahora.');
    } finally {
      setPidiendoProfundizacion(false);
    }
  }
  function irAnterior() {
    if (preguntaActual > 0) setPreguntaActual(preguntaActual - 1);
    else if (etapaActual > 0) { setEtapaActual(etapaActual - 1); setPreguntaActual(ETAPAS[etapaActual - 1].preguntas.length - 1); }
  }
  function irSiguiente() {
    const etapa = ETAPAS[etapaActual];
    if (preguntaActual < etapa.preguntas.length - 1) setPreguntaActual(preguntaActual + 1);
    else irA('stageEnd');
  }
  function siguienteEtapa() { setEtapaActual(etapaActual + 1); setPreguntaActual(0); irA('interview'); }

  function guardarNotaLibre(texto: string) {
    if (!texto.trim()) return;
    actualizar(h => { h.notasLibres.push({ id: 'n' + Date.now(), etapaIdx: etapaActual, texto: texto.trim(), fecha: new Date().toISOString() }); }, true);
    mostrarToast('Recuerdo guardado ✓');
  }

  // -------- Personas --------
  function agregarPersona(p: Omit<Persona, 'id'>) {
    if (!p.nombre.trim()) { mostrarToast('Ponele al menos un nombre'); return; }
    actualizar(h => { h.personas.push({ ...p, id: 'per' + Date.now() }); }, true);
    mostrarToast('Persona agregada ✓');
  }
  function borrarPersona(i: number) {
    if (!confirm('¿Quitar a esta persona de tu historia?')) return;
    actualizar(h => { h.personas.splice(i, 1); }, true);
  }

  // -------- Fotos --------
  async function agregarFoto(file: File, meta: Omit<Foto, 'id'>) {
    const img = new Image();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await new Promise<void>(resolve => { img.onload = () => resolve(); img.src = dataUrl; });
    const maxW = 1100;
    const scale = Math.min(1, maxW / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = img.width * scale; canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob: Blob = await new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.78));

    const fd = new FormData();
    fd.append('file', blob, 'foto.jpg');
    const res = await fetch('/api/historia/' + clave + '/foto', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) { mostrarToast(data.error || 'No se pudo subir la foto'); return; }
    actualizar(h => { h.fotografias.push({ ...meta, id: data.id }); }, true);
    mostrarToast('Foto agregada ✓');
  }
  async function borrarFoto(i: number) {
    if (!confirm('¿Quitar esta foto?')) return;
    const id = historia.fotografias[i].id;
    await fetch('/api/historia/' + clave + '/foto/' + id, { method: 'DELETE' }).catch(() => {});
    actualizar(h => { h.fotografias.splice(i, 1); }, true);
  }

  // -------- Línea de tiempo --------
  function agregarEvento(ev: Omit<Evento, 'id'>) {
    if (!ev.acontecimiento.trim()) { mostrarToast('Describí al menos el acontecimiento'); return; }
    actualizar(h => { h.lineaDeTiempo.push({ ...ev, id: 'ev' + Date.now() }); }, true);
    mostrarToast('Acontecimiento agregado ✓');
  }
  function borrarEvento(i: number) {
    if (!confirm('¿Quitar este acontecimiento?')) return;
    actualizar(h => { h.lineaDeTiempo.splice(i, 1); }, true);
  }

  function agregarContradiccion() {
    const nota = prompt('Describí brevemente la posible contradicción:');
    if (nota && nota.trim()) actualizar(h => { h.contradicciones.push({ id: 'c' + Date.now(), nota: nota.trim() }); }, true);
  }
  function borrarContradiccion(i: number) {
    actualizar(h => { h.contradicciones.splice(i, 1); }, true);
  }

  // -------- Exportación (descarga real de archivo — página normal, sin sandbox) --------
  function datosPersona(p: Persona) {
    return 'Nombre: ' + p.nombre + (p.apodo ? ' ("' + p.apodo + '")' : '') + '\n' + 'Relación: ' + (p.relacion || '-') + '\n' +
      (p.nacimiento ? 'Nacimiento: ' + p.nacimiento + '\n' : '') + (p.fallecimiento ? 'Fallecimiento: ' + p.fallecimiento + '\n' : '') +
      (p.comoConoci ? 'Cómo se conocieron: ' + p.comoConoci + '\n' : '') + (p.significado ? 'Qué significó: ' + p.significado + '\n' : '') +
      (p.aprendi ? 'Qué aprendió de ella: ' + p.aprendi + '\n' : '') + (p.recuerdos ? 'Recuerdos / historias: ' + p.recuerdos + '\n' : '') +
      (p.diria ? 'Qué le diría hoy: ' + p.diria + '\n' : '');
  }
  function construirTexto(paraIA: boolean) {
    let out = '';
    if (paraIA) {
      out += PROMPT_MAESTRO + '\n\n';
      out += '================================================\n';
      out += 'A PARTIR DE ACÁ: EL MATERIAL AUTOBIOGRÁFICO REAL\n';
      out += '(fuente primaria — todo lo de arriba son solo las reglas)\n';
      out += '================================================\n\n';
    }
    out += 'BIOGRAFÍA\n=========\n\nDATOS DEL PROTAGONISTA\n-----------------------\n';
    out += 'Generado: ' + new Date(historia.meta.creado).toLocaleString('es') + '\nÚltima actualización: ' + new Date(historia.meta.actualizado).toLocaleString('es') + '\n\n';
    ETAPAS.forEach((etapa, ei) => {
      out += 'ETAPA ' + (ei + 1) + ' — ' + etapa.titulo.toUpperCase() + '\n' + '-'.repeat(20) + '\n';
      etapa.preguntas.forEach((preg, pi) => {
        const r = getResp(historia, ei, pi);
        out += 'Pregunta: ' + preg + '\n';
        if (r.estado === 'no_responder') out += 'Respuesta: [Prefirió no responder]\n';
        else if (r.estado === 'no_recuerdo') out += 'Respuesta: [No recuerda]\n';
        else out += 'Respuesta: ' + (r.texto || '[sin responder]') + '\n';
        r.profundizaciones.forEach(f => { if (f.respuesta.trim()) out += '  · ' + f.pregunta + ' → ' + f.respuesta + '\n'; });
        out += '\n';
      });
    });
    out += 'NOTAS LIBRES / RECUERDOS ESPONTÁNEOS\n-------------------------------------\n';
    out += historia.notasLibres.length ? historia.notasLibres.map(n => '(Etapa ' + (n.etapaIdx + 1) + ') ' + n.texto).join('\n\n') + '\n\n' : '(ninguna)\n\n';
    out += 'PERSONAS DE LA HISTORIA\n-----------------------\n';
    out += historia.personas.length ? historia.personas.map(datosPersona).join('\n') : '(ninguna registrada)\n\n';
    out += 'FOTOGRAFÍAS\n-----------\n';
    out += historia.fotografias.length
      ? historia.fotografias.map((f, i) => '[Foto ' + (i + 1) + '] ' + (f.descripcion || 'sin descripción') + ' — ' + (f.año || 'año no indicado') + ', ' + (f.lugar || 'lugar no indicado') +
        '\n  Personas: ' + (f.personas || '-') + '\n  Qué ocurría: ' + (f.queOcurria || '-') + '\n  Por qué es importante: ' + (f.porQueImportante || '-') + '\n').join('\n')
      : '(ninguna)\n\n';
    out += 'LÍNEA DE TIEMPO\n---------------\n';
    out += historia.lineaDeTiempo.length
      ? historia.lineaDeTiempo.slice().sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).map(ev =>
          ev.fecha + (ev.edad ? ' (' + ev.edad + ' años)' : '') + ' — ' + ev.acontecimiento + '\n  Lugar: ' + (ev.lugar || '-') + ' | Personas: ' + (ev.personas || '-') + '\n' +
          (ev.descripcion ? '  ' + ev.descripcion + '\n' : '') + (ev.importancia ? '  Importancia: ' + ev.importancia + '\n' : '')).join('\n')
      : '(ninguno)\n\n';
    out += '\nPOSIBLES CONTRADICCIONES A REVISAR\n-----------------------------------\n';
    out += historia.contradicciones.length ? historia.contradicciones.map(c => '- ' + c.nota).join('\n') + '\n' : '(ninguna marcada)\n';
    return out;
  }
  function construirMarkdown() {
    let out = '# Biografía — material recopilado\n\n*Generado: ' + new Date(historia.meta.creado).toLocaleString('es') + '*\n\n';
    ETAPAS.forEach((etapa, ei) => {
      out += '## Etapa ' + (ei + 1) + ' — ' + etapa.titulo + '\n\n';
      etapa.preguntas.forEach((preg, pi) => {
        const r = getResp(historia, ei, pi);
        out += '**' + preg + '**\n\n';
        const txt = r.estado === 'no_responder' ? '_Prefirió no responder._' : r.estado === 'no_recuerdo' ? '_No recuerda._' : (r.texto || '_sin responder_');
        out += txt + '\n\n';
        r.profundizaciones.forEach(f => { if (f.respuesta.trim()) out += '- *' + f.pregunta + '* → ' + f.respuesta + '\n'; });
        out += '\n';
      });
    });
    out += '## Notas libres\n\n' + (historia.notasLibres.map(n => '- (Etapa ' + (n.etapaIdx + 1) + ') ' + n.texto).join('\n') || '_ninguna_') + '\n\n';
    out += '## Personas\n\n' + (historia.personas.map(p => '- **' + p.nombre + '** — ' + (p.relacion || '')).join('\n') || '_ninguna_') + '\n\n';
    out += '## Línea de tiempo\n\n' + (historia.lineaDeTiempo.map(e => '- ' + e.fecha + ' — ' + e.acontecimiento).join('\n') || '_ninguna_') + '\n';
    return out;
  }
  function descargar(filename: string, contenido: string, tipo: string) {
    const blob = new Blob([contenido], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function exportar(formato: 'txt' | 'md' | 'json' | 'ia') {
    const stamp = new Date().toISOString().slice(0, 10);
    if (formato === 'txt') descargar('mi-historia-' + stamp + '.txt', construirTexto(false), 'text/plain');
    else if (formato === 'ia') descargar('mi-historia-para-ia-' + stamp + '.txt', construirTexto(true), 'text/plain');
    else if (formato === 'md') descargar('mi-historia-' + stamp + '.md', construirMarkdown(), 'text/markdown');
    else descargar('mi-historia-' + stamp + '.json', JSON.stringify(historia, null, 2), 'application/json');
    mostrarToast('Archivo descargado ✓');
  }

  // ===================== RENDER =====================
  const hayProgreso = contarRespondidas(historia) > 0 || historia.personas.length > 0 || historia.fotografias.length > 0;

  return (
    <div className="mh-root">
      <link rel="stylesheet" href={GOOGLE_FONTS_URL} />
      <style>{ESTILOS}</style>
      {pantalla !== 'home' && (
        <div className="mh-topbar">
          <div className="mh-topbar-inner">
            <div className="mh-brand" onClick={() => irA('home')}>📖 <span>Mi Historia</span></div>
            <div className="mh-tabs">
              {([
                ['interview', '📖', 'Entrevista'], ['people', '👥', 'Personas'], ['photos', '📷', 'Fotos'],
                ['timeline', '🕐', 'Línea de vida'], ['review', '📋', 'Revisar'], ['final', '⬇️', 'Exportar'],
                ['prompt', '📜', 'Prompt maestro'],
              ] as [Pantalla, string, string][]).map(([id, icon, label]) => (
                <button key={id} className={'mh-tab' + (pantalla === id ? ' active' : '')} onClick={() => irA(id)}>{icon} <span>{label}</span></button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mh-wrap">
        {pantalla === 'home' && (
          <HomeScreen hayProgreso={hayProgreso} nombre={nombre} onContinuar={() => irA('interview')} onEmpezar={empezar} />
        )}

        {pantalla === 'interview' && (
          <InterviewScreen
            etapaActual={etapaActual} preguntaActual={preguntaActual}
            resp={getResp(historia, etapaActual, preguntaActual)}
            pidiendoProfundizacion={pidiendoProfundizacion}
            onTexto={ActualizarRespuestaTexto}
            onEspecial={marcarEstadoEspecial}
            onVolverDespues={toggleVolverDespues}
            onFollowup={actualizarFollowup}
            onProfundizar={pedirProfundizacion}
            onAnterior={irAnterior}
            onGuardarYSalir={() => mostrarToast('Progreso guardado ✓')}
            onSiguiente={irSiguiente}
            getRespDe={(e, p) => getResp(historia, e, p)}
          />
        )}

        {pantalla === 'stageEnd' && (
          <StageEndScreen
            etapaActual={etapaActual}
            onVolver={() => irA('interview')}
            onGuardarNota={guardarNotaLibre}
            onSiguienteEtapa={etapaActual === ETAPAS.length - 1 ? () => irA('final') : siguienteEtapa}
            esUltima={etapaActual === ETAPAS.length - 1}
          />
        )}

        {pantalla === 'people' && <PeopleScreen personas={historia.personas} onAgregar={agregarPersona} onBorrar={borrarPersona} />}
        {pantalla === 'photos' && <PhotosScreen clave={clave} fotos={historia.fotografias} onAgregar={agregarFoto} onBorrar={borrarFoto} />}
        {pantalla === 'timeline' && <TimelineScreen eventos={historia.lineaDeTiempo} onAgregar={agregarEvento} onBorrar={borrarEvento} />}
        {pantalla === 'prompt' && <PromptScreen texto={PROMPT_MAESTRO} />}
        {pantalla === 'review' && (
          <ReviewScreen
            getRespDe={(e, p) => getResp(historia, e, p)} notasLibres={historia.notasLibres}
            contradicciones={historia.contradicciones}
            onIr={(e, p) => irA('interview', { etapaActual: e, preguntaActual: p })}
            onAgregarContradiccion={agregarContradiccion} onBorrarContradiccion={borrarContradiccion}
          />
        )}
        {pantalla === 'final' && (
          <FinalScreen
            historia={historia} etapaCompleta={i => etapaCompleta(historia, i)} contarRespondidas={() => contarRespondidas(historia)}
            onExportar={exportar} onIrEntrevista={() => irA('interview')} onIrRevisar={() => irA('review')}
          />
        )}
      </div>

      {toast && <div className="mh-toast show">{toast}</div>}
    </div>
  );
}

// ===================== SUBCOMPONENTES =====================

function AutoTextarea({ value, onChange, placeholder, className, disabled, minHeight }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; disabled?: boolean; minHeight?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [grabando, setGrabando] = useState(false);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const [errorVoz, setErrorVoz] = useState('');
  const grabadorRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const valorRef = useRef(value);
  valorRef.current = value;

  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; }
  }, [value]);

  async function alternarGrabacion() {
    if (grabando) { grabadorRef.current?.stop(); return; }
    setErrorVoz('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const grabador = new MediaRecorder(stream);
      chunksRef.current = [];
      grabador.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      grabador.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setGrabando(false);
        setTranscribiendo(true);
        try {
          const blob = new Blob(chunksRef.current, { type: grabador.mimeType || 'audio/webm' });
          const fd = new FormData();
          fd.append('audio', blob, 'grabacion.webm');
          const res = await fetch('/api/historia/transcribir', { method: 'POST', body: fd });
          const data = await res.json();
          if (!res.ok) { setErrorVoz(data.error || 'No se pudo transcribir la grabación.'); return; }
          const previo = valorRef.current.trim();
          onChange(previo ? previo + ' ' + data.texto : data.texto);
        } catch {
          setErrorVoz('Error de conexión al transcribir.');
        } finally {
          setTranscribiendo(false);
        }
      };
      grabadorRef.current = grabador;
      grabador.start();
      setGrabando(true);
    } catch {
      setErrorVoz('No se pudo acceder al micrófono — revisá los permisos del navegador.');
    }
  }

  return (
    <div>
      <textarea
        ref={ref} className={'mh-answer ' + (className || '')} placeholder={placeholder} disabled={disabled}
        value={value} onChange={e => onChange(e.target.value)}
        style={{ minHeight: minHeight || 140 }}
      />
      {!disabled && (
        <div className="mh-row" style={{ marginTop: '0.5rem', alignItems: 'center', gap: '0.6rem' }}>
          <button type="button" className={'mh-chip' + (grabando || transcribiendo ? ' selected' : '')} disabled={transcribiendo} onClick={alternarGrabacion}>
            {transcribiendo ? <><span className="mh-spinner" /> Transcribiendo...</> : grabando ? '⏹ Detener grabación' : '🎤 Responder hablando'}
          </button>
          {errorVoz && <span style={{ fontSize: '0.78rem', color: 'var(--mh-danger)' }}>{errorVoz}</span>}
        </div>
      )}
    </div>
  );
}

function HomeScreen({ hayProgreso, nombre, onContinuar, onEmpezar }: { hayProgreso: boolean; nombre: string; onContinuar: () => void; onEmpezar: () => void }) {
  return (
    <>
      <div className="mh-hero">
        <div className="mh-eyebrow" style={{ textAlign: 'center' }}>Mi Historia</div>
        {nombre && (
          <p style={{ textAlign: 'center', fontWeight: 600, fontSize: '1.05rem', margin: '0 0 0.75rem' }}>
            Hola, {nombre} 👋 — esta es tu página, solo tuya.
          </p>
        )}
        <h1>Cuenta tu vida.<br />Nosotros la convertimos en historia.</h1>
        <p>Este proyecto te va a llevar, poco a poco, por los momentos, personas, decisiones, alegrías, dificultades y recuerdos que han formado tu vida. No hace falta escribir perfecto — contalo como lo recordés. Podés parar cuando quieras y seguir otro día.</p>
        <div className="mh-row" style={{ justifyContent: 'center' }}>
          {hayProgreso
            ? <button className="mh-btn mh-btn-primary" onClick={onContinuar}>▶ Continuar mi historia</button>
            : <button className="mh-btn mh-btn-primary" onClick={onEmpezar}>✨ Comenzar mi historia</button>}
        </div>
      </div>
      {[
        ['🗂️', '20 etapas', 'De tu nacimiento hasta el legado que querés dejar.'],
        ['💾', 'Se guarda solo, en cualquier dispositivo', 'Entrá desde el celular, la compu de tu casa o del trabajo — vas a ver el mismo progreso.'],
        ['🔒', 'Tus respuestas son tuyas', 'Nada se comparte hasta que vos decidas exportarlo.'],
      ].map(([icon, title, desc]) => (
        <div className="mh-card" key={title}>
          <div className="mh-row mh-between">
            <div><strong>{title}</strong><div className="mh-hint" style={{ marginTop: '0.1rem' }}>{desc}</div></div>
            <div style={{ fontSize: '1.6rem' }}>{icon}</div>
          </div>
        </div>
      ))}
    </>
  );
}

function InterviewScreen({ etapaActual, preguntaActual, resp, pidiendoProfundizacion, onTexto, onEspecial, onVolverDespues, onFollowup, onProfundizar, onAnterior, onGuardarYSalir, onSiguiente, getRespDe }: {
  etapaActual: number; preguntaActual: number; resp: Respuesta; pidiendoProfundizacion: boolean;
  onTexto: (t: string) => void; onEspecial: (t: EstadoPregunta) => void; onVolverDespues: () => void;
  onFollowup: (i: number, t: string) => void; onProfundizar: () => void; onAnterior: () => void;
  onGuardarYSalir: () => void; onSiguiente: () => void; getRespDe: (e: number, p: number) => Respuesta;
}) {
  const etapa = ETAPAS[etapaActual];
  const pregunta = etapa.preguntas[preguntaActual];
  const pctGlobal = Math.round(((etapaActual + (preguntaActual + 1) / etapa.preguntas.length) / ETAPAS.length) * 100);
  const esUltima = preguntaActual === etapa.preguntas.length - 1;
  const disabledEdit = resp.estado === 'no_responder' || resp.estado === 'no_recuerdo';

  return (
    <>
      <div className="mh-progress-shell">
        <div className="mh-progress-label"><span>Etapa {etapaActual + 1} de {ETAPAS.length} — {etapa.titulo}</span><span>{pctGlobal}% completado</span></div>
        <div className="mh-progress-track"><div className="mh-progress-fill" style={{ width: pctGlobal + '%' }} /></div>
        <div className="mh-subprogress">
          {etapa.preguntas.map((_, i) => {
            const st = getRespDe(etapaActual, i).estado;
            const cls = i === preguntaActual ? 'current' : st !== 'sin_responder' ? 'done' : '';
            return <div key={i} className={'mh-subprogress-dot ' + cls} />;
          })}
        </div>
      </div>

      <div className="mh-card">
        <div className="mh-row mh-between" style={{ marginBottom: '0.5rem' }}>
          <div className="mh-eyebrow">Pregunta {preguntaActual + 1} de {etapa.preguntas.length}</div>
          {resp.estado === 'no_responder' && <span className="mh-badge mh-badge-skip">Prefiere no responder</span>}
          {resp.estado === 'no_recuerdo' && <span className="mh-badge mh-badge-skip">No recuerda</span>}
          {resp.estado !== 'sin_responder' && resp.estado !== 'no_responder' && resp.estado !== 'no_recuerdo' && <span className="mh-badge mh-badge-done">✓ Respondida</span>}
        </div>
        {etapa.intro && preguntaActual === 0 && <p className="mh-hint" style={{ marginBottom: '1rem' }}>{etapa.intro}</p>}
        <div className="mh-question-text">{pregunta}</div>

        <AutoTextarea value={resp.texto} onChange={onTexto} disabled={disabledEdit} minHeight={etapa.grandes ? 200 : 140}
          placeholder="Escribí lo que recuerdes — una frase, un párrafo, o varias páginas si hace falta." />
        <div className="mh-hint">No necesitás escribir perfecto. Contalo como lo recordés — nosotros nos encargamos de convertirlo después en una historia.</div>

        <div className="mh-row" style={{ marginTop: '0.75rem' }}>
          <button className={'mh-chip' + (resp.estado === 'no_responder' ? ' selected' : '')} onClick={() => onEspecial('no_responder')}>Prefiero no responder</button>
          <button className={'mh-chip' + (resp.estado === 'no_recuerdo' ? ' selected' : '')} onClick={() => onEspecial('no_recuerdo')}>No recuerdo</button>
          <button className={'mh-chip' + (resp.volverDespues ? ' selected' : '')} onClick={onVolverDespues}>🔖 Volver a esto después</button>
        </div>

        {resp.texto.trim() && !disabledEdit && (
          <div className="mh-row" style={{ marginTop: '1rem' }}>
            <button className="mh-btn mh-btn-gold mh-btn-sm" disabled={pidiendoProfundizacion} onClick={onProfundizar}>
              {pidiendoProfundizacion ? <><span className="mh-spinner" /> Pensando preguntas...</> : '💬 Quiero contar más sobre esto'}
            </button>
          </div>
        )}

        {resp.profundizaciones.length > 0 && (
          <div className="mh-followup-block">
            {resp.profundizaciones.map((f, fi) => (
              <div key={fi}>
                <div className="mh-followup-q">{f.pregunta}</div>
                <AutoTextarea value={f.respuesta} onChange={t => onFollowup(fi, t)} minHeight={70} placeholder="Escribí lo que recuerdes..." />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mh-row mh-between" style={{ marginTop: '1.25rem' }}>
        <button className="mh-btn mh-btn-secondary" disabled={etapaActual === 0 && preguntaActual === 0} onClick={onAnterior}>← Anterior</button>
        <button className="mh-btn mh-btn-ghost" onClick={onGuardarYSalir}>💾 Guardar y continuar después</button>
        <button className="mh-btn mh-btn-primary" onClick={onSiguiente}>{esUltima ? 'Terminar etapa →' : 'Siguiente →'}</button>
      </div>
    </>
  );
}

function StageEndScreen({ etapaActual, onVolver, onGuardarNota, onSiguienteEtapa, esUltima }: {
  etapaActual: number; onVolver: () => void; onGuardarNota: (t: string) => void; onSiguienteEtapa: () => void; esUltima: boolean;
}) {
  const [nota, setNota] = useState('');
  return (
    <>
      <div className="mh-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2.2rem' }}>✅</div>
        <h2 style={{ margin: '0.5rem 0' }}>¡Etapa completada!</h2>
        <p className="mh-hint">Terminaste &quot;{ETAPAS[etapaActual].titulo}&quot; — etapa {etapaActual + 1} de {ETAPAS.length}.</p>
      </div>
      <div className="mh-card">
        <div className="mh-eyebrow">¿Recordaste algo más?</div>
        <p className="mh-hint" style={{ marginTop: 0 }}>A veces una pregunta despierta un recuerdo completamente diferente. Escribilo acá aunque no sepas en qué parte de tu historia encaja.</p>
        <AutoTextarea value={nota} onChange={setNota} placeholder="Un recuerdo suelto, algo que se te vino a la mente..." />
        <div className="mh-row mh-end" style={{ marginTop: '0.75rem' }}>
          <button className="mh-btn mh-btn-secondary mh-btn-sm" onClick={() => { onGuardarNota(nota); setNota(''); }}>Guardar este recuerdo</button>
        </div>
      </div>
      <div className="mh-row mh-between" style={{ marginTop: '1.25rem' }}>
        <button className="mh-btn mh-btn-secondary" onClick={onVolver}>← Volver a revisar esta etapa</button>
        <button className="mh-btn mh-btn-primary" onClick={onSiguienteEtapa}>{esUltima ? '🎉 Ver mi historia completa' : 'Continuar con la siguiente etapa →'}</button>
      </div>
    </>
  );
}

function PeopleScreen({ personas, onAgregar, onBorrar }: { personas: Persona[]; onAgregar: (p: Omit<Persona, 'id'>) => void; onBorrar: (i: number) => void }) {
  const [f, setF] = useState({ nombre: '', apodo: '', relacion: '', nacimiento: '', fallecimiento: '', comoConoci: '', significado: '', aprendi: '', recuerdos: '', diria: '' });
  function campo(k: keyof typeof f) { return f[k]; }
  function set(k: keyof typeof f) { return (v: string) => setF(prev => ({ ...prev, [k]: v })); }
  return (
    <>
      <div className="mh-eyebrow">Módulo</div>
      <h2 style={{ marginTop: 0 }}>Personas de mi historia</h2>
      <p className="mh-hint" style={{ marginTop: 0 }}>Agregá tantas personas como sea necesario — familia, amigos, mentores, amores.</p>
      <div className="mh-card">
        <h3 style={{ marginTop: 0 }}>Agregar persona</h3>
        <div className="mh-field"><label className="mh-field-label">Nombre</label><input className="mh-text-input" value={campo('nombre')} onChange={e => set('nombre')(e.target.value)} /></div>
        <div className="mh-field"><label className="mh-field-label">Apodo</label><input className="mh-text-input" value={campo('apodo')} onChange={e => set('apodo')(e.target.value)} /></div>
        <div className="mh-field"><label className="mh-field-label">Relación contigo</label><input className="mh-text-input" placeholder="Madre, mejor amigo, mentor..." value={campo('relacion')} onChange={e => set('relacion')(e.target.value)} /></div>
        <div className="mh-row" style={{ gap: '0.75rem' }}>
          <div className="mh-field" style={{ flex: 1 }}><label className="mh-field-label">Fecha de nacimiento (si la sabés)</label><input className="mh-text-input" value={campo('nacimiento')} onChange={e => set('nacimiento')(e.target.value)} /></div>
          <div className="mh-field" style={{ flex: 1 }}><label className="mh-field-label">Fecha de fallecimiento (si corresponde)</label><input className="mh-text-input" value={campo('fallecimiento')} onChange={e => set('fallecimiento')(e.target.value)} /></div>
        </div>
        <div className="mh-field"><label className="mh-field-label">¿Cómo la conociste?</label><AutoTextarea value={campo('comoConoci')} onChange={set('comoConoci')} minHeight={70} /></div>
        <div className="mh-field"><label className="mh-field-label">¿Qué significó para vos?</label><AutoTextarea value={campo('significado')} onChange={set('significado')} minHeight={70} /></div>
        <div className="mh-field"><label className="mh-field-label">¿Qué aprendiste de esta persona?</label><AutoTextarea value={campo('aprendi')} onChange={set('aprendi')} minHeight={70} /></div>
        <div className="mh-field"><label className="mh-field-label">Recuerdo más importante / historias relacionadas</label><AutoTextarea value={campo('recuerdos')} onChange={set('recuerdos')} /></div>
        <div className="mh-field"><label className="mh-field-label">¿Qué le dirías hoy si pudieras hablar con ella?</label><AutoTextarea value={campo('diria')} onChange={set('diria')} minHeight={70} /></div>
        <button className="mh-btn mh-btn-primary" onClick={() => { onAgregar(f); setF({ nombre: '', apodo: '', relacion: '', nacimiento: '', fallecimiento: '', comoConoci: '', significado: '', aprendi: '', recuerdos: '', diria: '' }); }}>+ Agregar a mi historia</button>
      </div>
      <h3>Ya agregadas ({personas.length})</h3>
      {personas.length === 0 && <div className="mh-empty">Todavía no agregaste a nadie. Las personas importantes de tu vida ayudan mucho a construir los capítulos después.</div>}
      {personas.map((p, i) => (
        <div className="mh-list-item" key={p.id}>
          <div className="mh-row mh-between">
            <h3>{p.nombre || 'Sin nombre'} {p.apodo ? '"' + p.apodo + '"' : ''}</h3>
            <button className="mh-btn-ghost mh-btn-sm" onClick={() => onBorrar(i)}>🗑️</button>
          </div>
          <div className="mh-meta">{p.relacion || 'Relación no indicada'}</div>
          {p.recuerdos && <div className="mh-body-text">{p.recuerdos}</div>}
        </div>
      ))}
    </>
  );
}

function PhotosScreen({ clave, fotos, onAgregar, onBorrar }: { clave: string; fotos: Foto[]; onAgregar: (f: File, meta: Omit<Foto, 'id'>) => void; onBorrar: (i: number) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [f, setF] = useState({ descripcion: '', año: '', lugar: '', personas: '', queOcurria: '', porQueImportante: '', etapaRelacionada: '' });
  function set(k: keyof typeof f) { return (v: string) => setF(prev => ({ ...prev, [k]: v })); }
  return (
    <>
      <div className="mh-eyebrow">Módulo</div>
      <h2 style={{ marginTop: 0 }}>Mis fotografías</h2>
      <p className="mh-hint" style={{ marginTop: 0 }}>Las fotos quedan guardadas en el mismo lugar que el resto de tu historia — disponibles desde cualquier dispositivo donde entres a este panel.</p>
      <div className="mh-card">
        <h3 style={{ marginTop: 0 }}>Agregar fotografía</h3>
        <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
        <div className="mh-field" style={{ marginTop: '0.75rem' }}><label className="mh-field-label">Descripción</label><AutoTextarea value={f.descripcion} onChange={set('descripcion')} minHeight={70} /></div>
        <div className="mh-row" style={{ gap: '0.75rem' }}>
          <div className="mh-field" style={{ flex: 1 }}><label className="mh-field-label">Año aproximado</label><input className="mh-text-input" value={f.año} onChange={e => set('año')(e.target.value)} /></div>
          <div className="mh-field" style={{ flex: 1 }}><label className="mh-field-label">Lugar</label><input className="mh-text-input" value={f.lugar} onChange={e => set('lugar')(e.target.value)} /></div>
        </div>
        <div className="mh-field"><label className="mh-field-label">Personas que aparecen</label><input className="mh-text-input" value={f.personas} onChange={e => set('personas')(e.target.value)} /></div>
        <div className="mh-field"><label className="mh-field-label">¿Qué estaba ocurriendo?</label><AutoTextarea value={f.queOcurria} onChange={set('queOcurria')} minHeight={70} /></div>
        <div className="mh-field"><label className="mh-field-label">¿Por qué es importante?</label><AutoTextarea value={f.porQueImportante} onChange={set('porQueImportante')} minHeight={70} /></div>
        <div className="mh-field">
          <label className="mh-field-label">Etapa relacionada</label>
          <select className="mh-text-input" value={f.etapaRelacionada} onChange={e => set('etapaRelacionada')(e.target.value)}>
            <option value="">— sin especificar —</option>
            {ETAPAS.map((e, i) => <option key={i} value={i}>{e.titulo}</option>)}
          </select>
        </div>
        <button className="mh-btn mh-btn-primary" onClick={() => {
          if (!file) return;
          onAgregar(file, f);
          setFile(null); setF({ descripcion: '', año: '', lugar: '', personas: '', queOcurria: '', porQueImportante: '', etapaRelacionada: '' });
        }}>+ Agregar a la galería</button>
      </div>
      <h3>Galería ({fotos.length})</h3>
      <div className="mh-photo-grid">
        {fotos.map((f2, i) => (
          <div className="mh-photo-card" key={f2.id}>
            <img src={'/api/historia/' + clave + '/foto/' + f2.id} alt="" />
            <div className="mh-cap">{f2.descripcion || 'Sin descripción'}<br />{f2.año}
              <div style={{ marginTop: '0.3rem' }}><button className="mh-btn-ghost mh-btn-sm" onClick={() => onBorrar(i)}>🗑️ quitar</button></div>
            </div>
          </div>
        ))}
      </div>
      {fotos.length === 0 && <div className="mh-empty">Todavía no subiste fotos.</div>}
    </>
  );
}

function TimelineScreen({ eventos, onAgregar, onBorrar }: { eventos: Evento[]; onAgregar: (e: Omit<Evento, 'id'>) => void; onBorrar: (i: number) => void }) {
  const [f, setF] = useState({ fecha: '', edad: '', acontecimiento: '', lugar: '', personas: '', descripcion: '', importancia: '' });
  function set(k: keyof typeof f) { return (v: string) => setF(prev => ({ ...prev, [k]: v })); }
  const ordenado = eventos.map((e, i) => ({ e, i })).sort((a, b) => (a.e.fecha || '').localeCompare(b.e.fecha || ''));
  return (
    <>
      <div className="mh-eyebrow">Módulo</div>
      <h2 style={{ marginTop: 0 }}>Mi línea de vida</h2>
      <p className="mh-hint" style={{ marginTop: 0 }}>Los acontecimientos se muestran ordenados cronológicamente — esto ayuda después a detectar si dos fechas no coinciden.</p>
      <div className="mh-card">
        <h3 style={{ marginTop: 0 }}>Agregar acontecimiento</h3>
        <div className="mh-row" style={{ gap: '0.75rem' }}>
          <div className="mh-field" style={{ flex: 1 }}><label className="mh-field-label">Año o fecha</label><input className="mh-text-input" placeholder="1998 o 1998-04" value={f.fecha} onChange={e => set('fecha')(e.target.value)} /></div>
          <div className="mh-field" style={{ flex: 1 }}><label className="mh-field-label">Edad</label><input className="mh-text-input" value={f.edad} onChange={e => set('edad')(e.target.value)} /></div>
        </div>
        <div className="mh-field"><label className="mh-field-label">Acontecimiento</label><input className="mh-text-input" value={f.acontecimiento} onChange={e => set('acontecimiento')(e.target.value)} /></div>
        <div className="mh-field"><label className="mh-field-label">Lugar</label><input className="mh-text-input" value={f.lugar} onChange={e => set('lugar')(e.target.value)} /></div>
        <div className="mh-field"><label className="mh-field-label">Personas involucradas</label><input className="mh-text-input" value={f.personas} onChange={e => set('personas')(e.target.value)} /></div>
        <div className="mh-field"><label className="mh-field-label">Descripción</label><AutoTextarea value={f.descripcion} onChange={set('descripcion')} minHeight={70} /></div>
        <div className="mh-field"><label className="mh-field-label">Importancia</label><AutoTextarea value={f.importancia} onChange={set('importancia')} minHeight={70} /></div>
        <button className="mh-btn mh-btn-primary" onClick={() => { onAgregar(f); setF({ fecha: '', edad: '', acontecimiento: '', lugar: '', personas: '', descripcion: '', importancia: '' }); }}>+ Agregar a la línea de vida</button>
      </div>
      <h3>Acontecimientos ({eventos.length})</h3>
      {ordenado.length === 0 && <div className="mh-empty">Todavía no agregaste acontecimientos.</div>}
      {ordenado.map(({ e, i }) => (
        <div className="mh-list-item" key={e.id}>
          <div className="mh-row mh-between">
            <h3>{e.fecha || 'Sin fecha'} {e.edad ? '· ' + e.edad + ' años' : ''}</h3>
            <button className="mh-btn-ghost mh-btn-sm" onClick={() => onBorrar(i)}>🗑️</button>
          </div>
          <div className="mh-meta">{e.lugar}</div>
          <div className="mh-body-text">{e.acontecimiento}</div>
          {e.descripcion && <div className="mh-body-text" style={{ marginTop: '0.4rem', color: 'var(--mh-ink-soft)' }}>{e.descripcion}</div>}
        </div>
      ))}
    </>
  );
}

function ReviewScreen({ getRespDe, notasLibres, contradicciones, onIr, onAgregarContradiccion, onBorrarContradiccion }: {
  getRespDe: (e: number, p: number) => Respuesta; notasLibres: HistoriaData['notasLibres']; contradicciones: Contradiccion[];
  onIr: (e: number, p: number) => void; onAgregarContradiccion: () => void; onBorrarContradiccion: (i: number) => void;
}) {
  return (
    <>
      <div className="mh-eyebrow">Revisión</div>
      <h2 style={{ marginTop: 0 }}>Revisar mis respuestas</h2>
      <p className="mh-hint" style={{ marginTop: 0 }}>Tocá cualquier pregunta para volver a editarla.</p>
      {ETAPAS.map((etapa, ei) => {
        const hechas = etapa.preguntas.filter((_, pi) => getRespDe(ei, pi).estado !== 'sin_responder').length;
        return (
          <div className="mh-card mh-tight" key={ei}>
            <div className="mh-row mh-between"><h3 style={{ margin: 0 }}>{ei + 1}. {etapa.titulo}</h3><span className="mh-hint" style={{ margin: 0 }}>{hechas}/{etapa.preguntas.length}</span></div>
            <div style={{ marginTop: '0.5rem' }}>
              {etapa.preguntas.map((preg, pi) => {
                const r = getRespDe(ei, pi);
                return (
                  <div key={pi} className="mh-kv" onClick={() => onIr(ei, pi)}>
                    <div className="mh-k">{preg}</div>
                    <div>
                      {r.estado === 'sin_responder' && <span className="mh-badge mh-badge-pending">Sin responder</span>}
                      {r.estado === 'no_responder' && <span className="mh-badge mh-badge-skip">Prefiere no responder</span>}
                      {r.estado === 'no_recuerdo' && <span className="mh-badge mh-badge-skip">No recuerda</span>}
                      {!['sin_responder', 'no_responder', 'no_recuerdo'].includes(r.estado) && <span className="mh-badge mh-badge-done">✓</span>}
                      {r.volverDespues && <span className="mh-badge mh-badge-review" style={{ marginLeft: '0.3rem' }}>🔖 volver</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <h3>Notas libres / recuerdos espontáneos</h3>
      {notasLibres.length === 0 && <div className="mh-empty">Sin recuerdos espontáneos todavía.</div>}
      {notasLibres.map(n => (
        <div className="mh-list-item" key={n.id}><div className="mh-meta">Recuerdo espontáneo — etapa {n.etapaIdx + 1}</div><div className="mh-body-text">{n.texto}</div></div>
      ))}
      <div style={{ marginTop: '1.5rem' }}><button className="mh-btn mh-btn-secondary mh-btn-sm" onClick={onAgregarContradiccion}>⚠️ Marcar una posible contradicción</button></div>
      {contradicciones.length > 0 && (
        <>
          <h3>Contradicciones marcadas</h3>
          {contradicciones.map((c, i) => (
            <div className="mh-list-item" key={c.id}><div className="mh-body-text">{c.nota}</div><button className="mh-btn-ghost mh-btn-sm" onClick={() => onBorrarContradiccion(i)}>quitar</button></div>
          ))}
        </>
      )}
    </>
  );
}

function PromptScreen({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Si el navegador bloquea el clipboard, el texto sigue ahí abajo
      // para seleccionar y copiar a mano.
    }
  }

  return (
    <>
      <div className="mh-card">
        <h1 style={{ marginTop: 0 }}>📜 Prompt maestro</h1>
        <p className="mh-hint" style={{ marginTop: 0 }}>
          Guardado acá para más adelante — cuando tengas la entrevista completa, pegás esto al inicio de una
          conversación de IA junto con el material exportado, y le pedís que escriba el libro siguiendo estas reglas.
        </p>
        <button className="mh-btn mh-btn-gold" onClick={copiar}>{copiado ? '✓ Copiado' : '📋 Copiar prompt completo'}</button>
      </div>
      <div className="mh-card">
        <pre style={{
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mh-sans), system-ui, sans-serif',
          fontSize: '0.92rem', lineHeight: 1.6, margin: 0, maxHeight: '65vh', overflowY: 'auto',
        }}>{texto}</pre>
      </div>
    </>
  );
}

function FinalScreen({ historia, etapaCompleta, contarRespondidas, onExportar, onIrEntrevista, onIrRevisar }: {
  historia: HistoriaData; etapaCompleta: (i: number) => boolean; contarRespondidas: () => number;
  onExportar: (f: 'txt' | 'md' | 'json' | 'ia') => void; onIrEntrevista: () => void; onIrRevisar: () => void;
}) {
  const etapasCompletas = ETAPAS.filter((_, i) => etapaCompleta(i)).length;
  return (
    <>
      <div className="mh-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2.4rem' }}>📖</div>
        <h1 style={{ margin: '0.5rem 0' }}>¡Tu historia está acá!</h1>
        <p className="mh-hint">Reuniste los recuerdos, personas y momentos que forman tu historia.</p>
      </div>
      <div className="mh-stat-grid">
        {[
          [etapasCompletas + '/' + ETAPAS.length, 'Etapas completas'],
          [contarRespondidas() + '/' + totalPreguntas(), 'Preguntas respondidas'],
          [String(historia.notasLibres.length), 'Recuerdos extra'],
          [String(historia.personas.length), 'Personas'],
          [String(historia.fotografias.length), 'Fotografías'],
          [String(historia.lineaDeTiempo.length), 'Acontecimientos'],
        ].map(([num, label]) => (
          <div className="mh-stat" key={label}><div className="mh-stat-num">{num}</div><div className="mh-stat-label">{label}</div></div>
        ))}
      </div>
      <div className="mh-card">
        <h3 style={{ marginTop: 0 }}>Exportar mi historia</h3>
        <p className="mh-hint" style={{ marginTop: 0 }}>Esta app todavía NO escribe tu biografía — solo recopila el material. La redacción literaria viene en un paso aparte, con estos archivos como base.</p>
        <div className="mh-row" style={{ marginTop: '0.75rem' }}>
          <button className="mh-btn mh-btn-primary" onClick={() => onExportar('txt')}>⬇ Exportar TXT</button>
          <button className="mh-btn mh-btn-secondary" onClick={() => onExportar('md')}>⬇ Exportar Markdown</button>
          <button className="mh-btn mh-btn-secondary" onClick={() => onExportar('json')}>⬇ Exportar JSON</button>
        </div>
        <hr className="mh-divider" />
        <h3 style={{ marginTop: 0 }}>Exportar para IA</h3>
        <p className="mh-hint" style={{ marginTop: 0 }}>Un documento especialmente preparado para pegarle a otra conversación de IA y pedirle que escriba el eBook.</p>
        <button className="mh-btn mh-btn-gold" onClick={() => onExportar('ia')}>🤖 Exportar para IA</button>
      </div>
      <div className="mh-row" style={{ justifyContent: 'center', marginTop: '1rem' }}>
        <button className="mh-btn mh-btn-ghost" onClick={onIrEntrevista}>✍️ Agregar más recuerdos</button>
        <button className="mh-btn mh-btn-ghost" onClick={onIrRevisar}>📋 Revisar mis respuestas</button>
      </div>
    </>
  );
}

const ESTILOS = `
.mh-root {
  --font-mh-serif: 'Fraunces'; --font-mh-sans: 'Karla';
  --mh-paper: #faf4e9; --mh-paper-deep: #f0e6d2; --mh-paper-deep-2: #e9dcc0; --mh-ink: #2b2118; --mh-ink-soft: #6b5d4a;
  --mh-wine: #7a2036; --mh-wine-soft: #a44759; --mh-wine-wash: rgba(122,32,54,0.08); --mh-gold: #a5761f; --mh-gold-soft: #d9ae5e;
  --mh-border: #e2d3b0; --mh-success: #3f6b49; --mh-success-wash: rgba(63,107,73,0.1); --mh-danger: #a13a2f;
  --mh-shadow: 0 10px 30px rgba(43,33,24,0.12); --mh-radius: 18px;
  background: radial-gradient(ellipse 800px 500px at 15% -10%, var(--mh-wine-wash), transparent 60%), var(--mh-paper);
  color: var(--mh-ink); font-family: var(--font-mh-sans), system-ui, sans-serif; min-height: 100vh;
}
.mh-root h1, .mh-root h2, .mh-root h3 { font-family: var(--font-mh-serif), Georgia, serif; }
.mh-root textarea, .mh-root input, .mh-root button, .mh-root select { font-family: inherit; }
.mh-root button { cursor: pointer; }
.mh-wrap { max-width: 720px; margin: 0 auto; padding: 1.5rem 1.25rem 5rem; }
.mh-topbar { position: sticky; top: 0; z-index: 20; background: rgba(250,244,233,0.92); backdrop-filter: blur(8px); border-bottom: 1px solid var(--mh-border); }
.mh-topbar-inner { max-width: 720px; margin: 0 auto; padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.mh-brand { display: flex; align-items: center; gap: 0.5rem; font-family: var(--font-mh-serif), serif; font-weight: 600; font-size: 1.15rem; color: var(--mh-wine); cursor: pointer; }
.mh-tabs { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.mh-tab { border: none; background: transparent; color: var(--mh-ink-soft); padding: 0.4rem 0.65rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 0.35rem; white-space: nowrap; }
.mh-tab.active { background: var(--mh-wine); color: #fff8ee; }
.mh-progress-shell { margin: 1.25rem 0 0.35rem; }
.mh-progress-label { display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--mh-ink-soft); margin-bottom: 0.4rem; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; }
.mh-progress-track { height: 8px; border-radius: 999px; background: var(--mh-paper-deep-2); overflow: hidden; }
.mh-progress-fill { height: 100%; background: linear-gradient(90deg, var(--mh-gold-soft), var(--mh-wine)); border-radius: 999px; transition: width 0.4s ease; }
.mh-subprogress { display: flex; gap: 0.3rem; margin-top: 0.6rem; }
.mh-subprogress-dot { flex: 1; height: 4px; border-radius: 999px; background: var(--mh-paper-deep-2); }
.mh-subprogress-dot.done { background: var(--mh-success); }
.mh-subprogress-dot.current { background: var(--mh-wine); }
.mh-card { background: var(--mh-paper-deep); border: 1px solid var(--mh-border); border-radius: var(--mh-radius); padding: 1.75rem 1.5rem; box-shadow: var(--mh-shadow); margin-top: 1.25rem; }
.mh-card.mh-tight { padding: 1.25rem; }
.mh-eyebrow { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--mh-gold); margin-bottom: 0.5rem; }
.mh-question-text { font-size: 1.5rem; line-height: 1.35; font-weight: 500; margin: 0 0 1.25rem; }
.mh-answer { width: 100%; resize: vertical; border: 1px solid var(--mh-border); border-radius: 12px; padding: 0.9rem 1rem; font-size: 1rem; line-height: 1.6; background: var(--mh-paper); color: var(--mh-ink); overflow: hidden; box-sizing: border-box; }
.mh-answer:focus { outline: none; border-color: var(--mh-wine-soft); box-shadow: 0 0 0 3px var(--mh-wine-wash); }
.mh-hint { font-size: 0.8rem; color: var(--mh-ink-soft); margin-top: 0.6rem; line-height: 1.5; font-style: italic; }
.mh-row { display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center; }
.mh-row.mh-between { justify-content: space-between; }
.mh-row.mh-end { justify-content: flex-end; }
.mh-btn { border: none; border-radius: 999px; padding: 0.75rem 1.3rem; font-weight: 700; font-size: 0.92rem; display: inline-flex; align-items: center; gap: 0.45rem; white-space: nowrap; }
.mh-btn-primary { background: var(--mh-wine); color: #fff8ee; box-shadow: 0 3px 0 #4a1120; }
.mh-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.mh-btn-secondary { background: var(--mh-paper-deep-2); color: var(--mh-ink); }
.mh-btn-ghost { background: transparent; color: var(--mh-ink-soft); padding: 0.6rem 0.8rem; }
.mh-btn-ghost:hover { color: var(--mh-ink); text-decoration: underline; }
.mh-btn-gold { background: var(--mh-gold-soft); color: #2b2118; }
.mh-btn-sm { padding: 0.5rem 0.9rem; font-size: 0.82rem; }
.mh-chip { border: 1px solid var(--mh-border); background: var(--mh-paper); color: var(--mh-ink-soft); border-radius: 999px; padding: 0.45rem 0.85rem; font-size: 0.82rem; font-weight: 600; }
.mh-chip.selected { background: var(--mh-wine); color: #fff8ee; border-color: var(--mh-wine); }
.mh-badge { font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 999px; letter-spacing: 0.02em; }
.mh-badge-pending { background: var(--mh-paper-deep-2); color: var(--mh-ink-soft); }
.mh-badge-done { background: var(--mh-success-wash); color: var(--mh-success); }
.mh-badge-skip { background: var(--mh-paper-deep-2); color: var(--mh-ink-soft); font-style: italic; }
.mh-badge-review { background: rgba(165,118,31,0.15); color: var(--mh-gold); }
.mh-followup-block { margin-top: 1.25rem; padding-top: 1.1rem; border-top: 1px dashed var(--mh-border); display: flex; flex-direction: column; gap: 0.9rem; }
.mh-followup-q { font-size: 0.95rem; font-weight: 600; margin-bottom: 0.4rem; }
.mh-hero { text-align: center; padding: 3rem 1rem 1.5rem; }
.mh-hero h1 { font-size: clamp(2rem, 6vw, 2.8rem); margin: 0 0 0.75rem; line-height: 1.15; }
.mh-hero p { color: var(--mh-ink-soft); font-size: 1.05rem; max-width: 480px; margin: 0 auto 1.75rem; line-height: 1.6; }
.mh-stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin: 1.5rem 0; }
@media (min-width: 480px) { .mh-stat-grid { grid-template-columns: repeat(3, 1fr); } }
.mh-stat { background: var(--mh-paper); border: 1px solid var(--mh-border); border-radius: 14px; padding: 1rem; text-align: center; }
.mh-stat-num { font-family: var(--font-mh-serif), serif; font-size: 1.8rem; color: var(--mh-wine); font-weight: 600; }
.mh-stat-label { font-size: 0.75rem; color: var(--mh-ink-soft); text-transform: uppercase; letter-spacing: 0.03em; margin-top: 0.2rem; }
.mh-field-label { font-size: 0.82rem; font-weight: 700; color: var(--mh-ink-soft); margin-bottom: 0.35rem; display: block; }
.mh-field { margin-bottom: 0.9rem; }
.mh-text-input { width: 100%; border: 1px solid var(--mh-border); border-radius: 10px; padding: 0.65rem 0.85rem; background: var(--mh-paper); color: var(--mh-ink); font-size: 0.95rem; box-sizing: border-box; }
.mh-text-input:focus { outline: none; border-color: var(--mh-wine-soft); }
.mh-list-item { background: var(--mh-paper); border: 1px solid var(--mh-border); border-radius: 14px; padding: 1rem 1.1rem; margin-bottom: 0.75rem; }
.mh-list-item h3 { margin: 0 0 0.3rem; font-size: 1.05rem; }
.mh-meta { font-size: 0.78rem; color: var(--mh-ink-soft); margin-bottom: 0.5rem; }
.mh-body-text { font-size: 0.9rem; line-height: 1.5; white-space: pre-wrap; }
.mh-photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.75rem; margin-top: 1rem; }
.mh-photo-card { border-radius: 12px; overflow: hidden; border: 1px solid var(--mh-border); background: var(--mh-paper); }
.mh-photo-card img { width: 100%; height: 120px; object-fit: cover; display: block; }
.mh-cap { padding: 0.5rem 0.6rem; font-size: 0.75rem; color: var(--mh-ink-soft); }
.mh-empty { text-align: center; color: var(--mh-ink-soft); padding: 2rem 1rem; font-style: italic; }
.mh-toast { position: fixed; bottom: 1.25rem; left: 50%; transform: translateX(-50%); background: var(--mh-ink); color: var(--mh-paper); padding: 0.7rem 1.2rem; border-radius: 999px; font-size: 0.85rem; font-weight: 600; box-shadow: var(--mh-shadow); z-index: 50; }
.mh-spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; display: inline-block; animation: mh-spin 0.7s linear infinite; }
@keyframes mh-spin { to { transform: rotate(360deg); } }
.mh-divider { height: 1px; background: var(--mh-border); margin: 1.5rem 0; border: none; }
.mh-kv { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.85rem; padding: 0.55rem 0; cursor: pointer; border-bottom: 1px solid var(--mh-border); }
.mh-kv .mh-k { flex: 1; }
`;
