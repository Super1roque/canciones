import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Guía: producir un libro de Mi Historia',
};

function Seccion({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: '3rem', scrollMarginTop: '5rem' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--accent-soft)' }}>
        {titulo}
      </h2>
      <div style={{ fontSize: '0.95rem', lineHeight: 1.75, color: 'var(--text)' }}>{children}</div>
    </section>
  );
}

function Nota({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        padding: '0.85rem 1.1rem', margin: '1rem 0', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.65,
      }}
    >
      {children}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: 'Fira Mono, monospace', fontSize: '0.85em', background: 'var(--surface2)',
        padding: '0.1rem 0.35rem', borderRadius: 4, border: '1px solid var(--border)',
      }}
    >
      {children}
    </code>
  );
}

function Bloque({ children }: { children: string }) {
  return (
    <pre
      style={{
        fontFamily: 'Fira Mono, monospace', fontSize: '0.8rem', lineHeight: 1.6,
        background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        padding: '0.9rem 1.1rem', overflowX: 'auto', margin: '0.75rem 0', whiteSpace: 'pre-wrap',
      }}
    >
      {children}
    </pre>
  );
}

const FASES = [
  { id: 'resumen', titulo: 'Resumen' },
  { id: 'fase-1', titulo: '1. Recolectar el contenido' },
  { id: 'fase-2', titulo: '2. Generar el texto del libro' },
  { id: 'fase-3', titulo: '3. Libro de lectura en HTML' },
  { id: 'fase-4', titulo: '4. EPUB limpio para narración' },
  { id: 'fase-5', titulo: '5. Audiolibro' },
  { id: 'fase-6', titulo: '6. Maquetado para imprenta' },
  { id: 'fase-7', titulo: '7. Portada y contraportada física' },
  { id: 'fase-8', titulo: '8. Página web con audio sincronizado' },
  { id: 'fase-9', titulo: '9. Código QR' },
  { id: 'checklist', titulo: 'Checklist para el próximo libro' },
];

export default function GuiaLibrosPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <header className="header">
        <div className="header-inner">
          <div className="logo"><span className="logo-icon">📖</span><span className="logo-text">Canciones</span></div>
          <a href="/admin" className="nav-btn">← Volver</a>
        </div>
      </header>

      <style>{`
        .guia-contenido p, .guia-contenido ul, .guia-contenido ol, .guia-contenido table {
          margin-bottom: 0.9rem;
        }
        .guia-contenido p:last-child, .guia-contenido ul:last-child,
        .guia-contenido ol:last-child, .guia-contenido table:last-child {
          margin-bottom: 0;
        }
      `}</style>
      <div className="guia-contenido" style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1.5rem 6rem' }}>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 700, marginBottom: '0.4rem' }}>📖 Producir un libro de Mi Historia</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: 1.6 }}>
          Guía de referencia del proceso completo: de las respuestas de un tenant en Mi Historia hasta el libro
          terminado en todos sus formatos (lectura, EPUB, audiolibro, impreso, página web, QR). Pensada para
          aplicarse a cualquier tenant, no solo al primero que se hizo. Si algo de esto cambia o se mejora,
          actualizar este archivo (<Code>app/admin/guia-libros/page.tsx</Code>) junto con el cambio.
        </p>

        <nav
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            padding: '1rem 1.25rem', marginBottom: '2.5rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            Índice
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {FASES.map((f) => (
              <a key={f.id} href={`#${f.id}`} style={{ fontSize: '0.86rem', color: 'var(--accent-soft)', textDecoration: 'none' }}>
                {f.titulo}
              </a>
            ))}
          </div>
        </nav>

        <Seccion id="resumen" titulo="Resumen">
          <p>
            De las respuestas de un tenant en Mi Historia pueden salir, en orden, hasta siete entregables
            distintos: dos versiones de texto (Prompt Maestro y Crónica), cada una en tres formatos posibles
            (libro de lectura en HTML, EPUB para narración, maquetado para imprenta), más la portada física,
            el audiolibro, la página web sincronizada y el código QR. No todos los tenants van a querer
            todas las fases — lo normal es empezar por el libro de lectura (Fase 3) y avanzar según lo que pidan.
          </p>
        </Seccion>

        <Seccion id="fase-1" titulo="1. Recolectar el contenido">
          <p>Todo nace en la app Mi Historia, que guarda en Firestore (colección <Code>mi_historia</Code>, un documento por persona identificado por su <Code>clave</Code>) tres tipos de material:</p>
          <ul style={{ paddingLeft: '1.3rem', margin: '0.75rem 0', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li><strong>Respuestas de texto</strong>, organizadas por etapa y pregunta (clave <Code>e{'{etapa}'}_p{'{pregunta}'}</Code>).</li>
            <li><strong>Respuestas con voz real</strong>: algunas se graban hablando en vez de escribiendo. Quedan marcadas con <Code>tieneAudio:true</Code> en Firestore y el audio vive en Firebase Storage, servido por <Code>GET /api/historia/{'{clave}'}/audio/{'{claveResp}'}</Code>.</li>
            <li><strong>Fotografías</strong>, cada una con descripción, año, lugar, personas y por qué importa.</li>
          </ul>
          <Nota>
            Antes de regenerar cualquier libro: volver a bajar el JSON fresco de <Code>/api/historia/{'{clave}'}</Code> (<Code>curl -s https://corridos.online/api/historia/{'{clave}'}</Code>) y compararlo contra la última copia guardada. El conteo de preguntas puede quedarse igual aunque el texto se haya editado — nunca asumir que &quot;nada cambió&quot; sin comparar.
          </Nota>
        </Seccion>

        <Seccion id="fase-2" titulo="2. Generar el texto del libro">
          <p>Cinco técnicas/&quot;voces&quot; distintas viven como prompts en <Code>lib/prompts.ts</Code>, expuestas como pestañas dentro de Mi Historia (<Code>components/MiHistoriaApp.tsx</Code>), visibles solo para la persona principal de cada tenant (<Code>esPrincipal</Code>):</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', margin: '1rem 0' }}>
            <tbody>
              {[
                ['Maestro', 'Verdad estricta, cero invención, primera persona — es "el libro oficial".'],
                ['Mímesis', 'Hechos reales, pero la escena se puede "vestir" (luz, ritmo) — tercera persona.'],
                ['Borroscoso', 'Ficción declarada — herramienta aparte, no es biografía.'],
                ['Écfrasis', 'Técnica narrativa/sensorial sobre las fotos, sin inventar hechos.'],
                ['Periodismo narrativo', 'No parte de las respuestas crudas: transforma un libro ya escrito al estilo crónica (inspirado en Leila Guerriero — precisión, observación minuciosa, el cronista mira y no opina).'],
              ].map(([nombre, desc]) => (
                <tr key={nombre} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.5rem 0.75rem 0.5rem 0', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{nombre}</td>
                  <td style={{ padding: '0.5rem 0', color: 'var(--text-muted)' }}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Nota>
            Patrón establecido: cuando se regenera el libro Maestro de un tenant con contenido nuevo, ofrecer —sin que lo pida dos veces— regenerar también la versión Crónica con los mismos cambios.
          </Nota>
        </Seccion>

        <Seccion id="fase-3" titulo="3. Libro de lectura en HTML">
          <p>
            <strong>Por qué HTML standalone y no un Artifact de Claude:</strong> el exportador a PDF de los
            Artifacts duplicaba o cortaba fotos entre páginas, sin importar qué CSS se probara
            (<Code>break-inside:avoid</Code>, quitar <Code>transform:rotate</Code>, etc.). Un archivo HTML
            plano, guardado localmente y abierto en Chrome, impreso con Cmd+P, respeta la paginación
            correctamente.
          </p>
          <p style={{ marginTop: '0.75rem' }}><strong>Cómo se arma:</strong></p>
          <ul style={{ paddingLeft: '1.3rem', margin: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li>Las fotos se incrustan como <Code>data:</Code> URI en base64, directo en el HTML — el archivo queda 100% portable, sin depender de internet.</li>
            <li>Tipografía consistente en todas las versiones: <strong>Fraunces</strong> (títulos), <strong>Lora</strong> (cuerpo), <strong>Karla</strong> (UI/pies de foto).</li>
            <li>Para lectores mayores: subir el tamaño de letra del cuerpo (ej. de 1.05rem a 1.3rem) y escalar todo lo demás (títulos, citas, notas, tabla de cronología) en la misma proporción para mantener la jerarquía visual.</li>
          </ul>
        </Seccion>

        <Seccion id="fase-4" titulo="4. EPUB limpio para narración">
          <p>Se construye solo cuando el libro se va a convertir en audiolibro con IA (ElevenLabs). El objetivo es que el narrador no lea nada que no sea la historia en sí.</p>
          <p style={{ marginTop: '0.75rem' }}><strong>Se quita:</strong></p>
          <ul style={{ paddingLeft: '1.3rem', margin: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <li>El índice visible (el EPUB trae su propia navegación interna, separada).</li>
            <li>La tabla de cronología (se lee mal como tabla; esos datos ya están contados en prosa dentro de los capítulos).</li>
            <li>El álbum de fotos (son solo pies de foto sueltos, sin prosa real).</li>
            <li>Las fotos y sus pies de foto dentro de los capítulos (la IA no puede &quot;leer&quot; una imagen, y el pie interrumpe el relato).</li>
            <li>Las citas destacadas al final de cada capítulo (repiten una frase ya dicha antes en el mismo capítulo — sonaría redundante narrado en voz alta).</li>
          </ul>
          <p style={{ marginTop: '0.5rem' }}><strong>Se deja:</strong> dedicatoria, prólogo, los capítulos completos (con epígrafes en cursiva y recuadros de contexto integrados como párrafos normales), epílogo, y &quot;Personas importantes&quot;.</p>
          <Nota>
            Los números de capítulo se convierten de romanos a palabras (&quot;Capítulo diecinueve&quot; en vez de &quot;XIX&quot;) — los números romanos se leen mal o se deletrean letra por letra en casi cualquier motor de TTS.
          </Nota>
          <p style={{ marginTop: '0.5rem' }}>
            El resultado se empaqueta como un EPUB3 válido: <Code>mimetype</Code> sin comprimir y primero en el
            zip, <Code>META-INF/container.xml</Code>, <Code>content.opf</Code>, <Code>nav.xhtml</Code> +{' '}
            <Code>toc.ncx</Code> (compatibilidad EPUB2).
          </p>
        </Seccion>

        <Seccion id="fase-5" titulo="5. Audiolibro">
          <ol style={{ paddingLeft: '1.3rem', margin: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li><strong>Clonar la voz:</strong> compilar en un solo archivo todas las respuestas del tenant donde grabó con su voz real (<Code>tieneAudio:true</Code>), separadas por un pequeño silencio entre cada una. Unos pocos minutos de audio real ya alcanzan para clonar voz en ElevenLabs.</li>
            <li><strong>Generar el audiolibro:</strong> subir el EPUB de la Fase 4 a ElevenLabs (Studio/Projects) y generar la narración completa con la voz clonada.</li>
          </ol>
          <Nota>
            ElevenLabs no regala, desde la interfaz de Studio, las marcas de tiempo por párrafo — su exportación
            de subtítulos (SRT) pasa por Scribe, que consume créditos (~330 por minuto). La alternativa
            gratuita, usada en la Fase 8, es alinear el audio ya generado contra el texto del EPUB de forma
            local.
          </Nota>
        </Seccion>

        <Seccion id="fase-6" titulo="6. Maquetado para imprenta">
          <p>
            Se usa <strong>Paged.js</strong> (<Code>https://cdn.jsdelivr.net/npm/pagedjs@0.4.3/dist/paged.polyfill.js</Code>)
            para lograr paginación real en HTML — CSS Paged Media (saltos de página, márgenes por página,
            índice con número automático vía <Code>target-counter</Code>) que los navegadores no soportan de forma nativa.
          </p>
          <p style={{ marginTop: '0.75rem' }}><strong>Especificaciones típicas</strong> (el tamaño de corte y los márgenes se ajustan según lo que pida cada tenant):</p>
          <Bloque>{`@page{
  size: <ancho> <alto>;   /* ej. 18cm 24cm — el tamaño de corte final */
  bleed: 3mm;
  marks: crop;
}
@page :right{  /* páginas impares — margen interior (lomo) más grande */
  margin-top: 1.6cm; margin-bottom: 2.0cm;
  margin-left: 2.0cm; margin-right: 1.4cm;
}
@page :left{   /* páginas pares — espejo del anterior */
  margin-top: 1.6cm; margin-bottom: 2.0cm;
  margin-left: 1.4cm; margin-right: 2.0cm;
}
section.block{ break-before: right; }  /* capítulos siempre en página impar */`}</Bloque>
          <ul style={{ paddingLeft: '1.3rem', margin: '0.75rem 0', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li>Se imprime en hojas carta (8.5×11in) — sobra margen alrededor del trim para que las marcas de corte queden visibles.</li>
            <li>Márgenes espejados (interior más grande hacia el lomo) para encuadernación.</li>
            <li>Índice con numeración automática vía <Code>target-counter(attr(href), page)</Code>.</li>
          </ul>
          <Nota>
            <strong>Bug real de Paged.js:</strong> una página nombrada (ej. la portada, vía <Code>@page portada-page</Code>) no sobreescribe correctamente los márgenes heredados de <Code>:right</Code>/<Code>:left</Code> — el contenido centrado de esa página queda visualmente descentrado. No pelear con el CSS de márgenes: corregirlo con un <Code>transform: translateX()</Code> pequeño que compensa el corrimiento conocido (la mitad de la diferencia entre margen interior y exterior), sin tocar el margen de encuadernación real.
          </Nota>
          <Nota>
            <strong>Cómo imprimir sin que salga descentrado:</strong> nunca mandar a imprimir directo desde el diálogo de Chrome a la impresora física — su comportamiento centrando una página chica en papel más grande es inconsistente. En su lugar: Chrome → Guardar como PDF → abrir ese PDF en Vista Previa (macOS) → imprimir desde ahí, que sí centra de forma confiable. Imprimir siempre una página de prueba antes del libro completo.
          </Nota>
        </Seccion>

        <Seccion id="fase-7" titulo="7. Portada y contraportada física (pasta dura)">
          <p>
            El tamaño del material adhesivo/wrap que el tenant ya tiene (ej. 11×17in) determina el trim de
            las páginas, vía las fórmulas estándar de encuadernación de tapa dura:
          </p>
          <Bloque>{`Trim height = Alto del material − 2×(square + turn-in)
Trim width  ≈ (Ancho del material − spine width) / 2

Spine width = número de páginas ÷ páginas-por-pulgada del papel (PPI)
  (varía según el gramaje — ~200-300 PPI es típico para papel de foto-libro)

Panel de arte por tapa = Trim width + square + turn-in (ancho) × Alto completo del material`}</Bloque>
          <p>Valores de referencia usados (ajustables por material/encuadernador): grosor de cartón ~1/8in, square ~3/16in, turn-in ~3/4in, hinge gap ~3/8in por lado.</p>
          <Nota>
            <strong>Regla de oro, no negociable:</strong> nunca recortar el arte de portada que el tenant ya
            generó (con IA o no). En vez de eso, <strong>rellenar el canvas</strong>: tomar un color de fondo
            limpio de una zona sin elementos oscuros de la propia imagen, extender el lienzo en los cuatro
            lados hasta llegar a la proporción exacta que necesita el panel impreso, dejando al menos ~10% de
            margen de seguridad arriba y abajo (esa es la zona que se pliega hacia adentro en la encuadernación).
          </Nota>
          <p>Portada y contraportada se arman como <strong>un solo archivo de wrap continuo</strong> (contraportada + franja de bisagra + lomo + franja de bisagra + portada) del tamaño exacto del material — no como dos piezas sueltas.</p>
        </Seccion>

        <Seccion id="fase-8" titulo="8. Página web con audio sincronizado">
          <p>
            El EPUB de la Fase 4 no tiene fotos, y el orden exacto del texto narrado puede diferir levemente
            del libro original — hace falta reconstruir, para cada párrafo, en qué segundo exacto del audio
            empieza.
          </p>
          <p style={{ marginTop: '0.75rem' }}>
            <strong>Alineación forzada, local, sin gastar créditos de ElevenLabs:</strong> transcribir el audio
            ya generado con <Code>faster-whisper</Code> (corre en cualquier máquina, no necesita la API de
            ElevenLabs), y comparar esa transcripción palabra por palabra contra el texto conocido del EPUB
            (con <Code>difflib.SequenceMatcher</Code>) para anclar el segundo de inicio de cada párrafo.
            Con el primer libro hecho así: 97.3% de coincidencia directa — suficiente para sincronía a nivel
            de párrafo (no palabra por palabra, que sería innecesariamente ruidoso para un libro largo).
          </p>
          <p style={{ marginTop: '0.75rem' }}><strong>La página en sí:</strong> texto que se resalta y hace scroll automático en sincronía con el audio, tocar cualquier párrafo salta el audio ahí, diseño responsive. Las fotos originales del libro se pueden reinsertar en su posición exacta (extraídas del HTML de lectura ya armado, subidas a Storage, servidas por una ruta propia).</p>
          <Nota>
            No reutilizar el sistema existente de &quot;relatos compartidos&quot; del sitio
            (<Code>relatos_compartidos</Code> / <Code>RelatoPublicoClient.tsx</Code>) para libros largos: ese
            sistema (a) no soporta <em>range requests</em>, así que no se puede adelantar/atrasar el audio en
            el celular sin descargarlo completo, y (b) resalta palabra por palabra, pensado para textos
            cortos. Para un libro completo conviene una ruta propia, con streaming de audio vía Range (soporte
            de <Code>Accept-Ranges</Code>/<Code>206 Partial Content</Code>) y resaltado por párrafo, no por palabra.
          </Nota>
          <p>Configurar etiquetas Open Graph con la portada del libro, para que al compartir el link por WhatsApp aparezca la miniatura correcta.</p>
        </Seccion>

        <Seccion id="fase-9" titulo="9. Código QR">
          <p>
            Generar con una librería real de códigos QR (corrección de error alta, buena para impresión) que
            apunte al link público de la Fase 8 — nunca pedirlo a un generador de imágenes con IA, que casi
            nunca produce un QR que realmente escanea.
          </p>
          <p>Entregar como una <strong>hoja de impresión independiente</strong> (mismo estilo visual del libro), para insertarla suelta junto al libro físico sin tocar ningún archivo del maquetado ya armado.</p>
        </Seccion>

        <Seccion id="checklist" titulo="Checklist para el próximo libro">
          <ol style={{ paddingLeft: '1.3rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            <li>Bajar fresco el JSON de <Code>/api/historia/{'{clave}'}</Code> y comparar contra la copia anterior — confirmar qué es nuevo.</li>
            <li>Elegir la técnica de texto (Maestro primero; Crónica después, aplicando el prompt de Periodismo Narrativo sobre el libro Maestro ya escrito).</li>
            <li>Armar el libro de lectura en HTML standalone: fotos en base64, tipografía Fraunces/Lora/Karla, tamaño de letra pensado para el público que lo va a leer.</li>
            <li>Si se quiere audiolibro: construir el EPUB limpio (quitar índice/cronología/álbum/citas repetidas, números de capítulo en palabras).</li>
            <li>Si hay respuestas grabadas con voz real: compilarlas para clonar la voz en ElevenLabs; generar el audiolibro completo desde el EPUB.</li>
            <li>Si se va a imprimir: maquetado con Paged.js (trim, sangrado, marcas de corte, márgenes espejados), imprimir siempre vía PDF → Vista Previa.</li>
            <li>Si va a llevar pasta dura: calcular el wrap a partir del material disponible, nunca recortar el arte de portada (rellenar canvas en su lugar).</li>
            <li>Si se quiere la experiencia de audio sincronizado en línea: alinear el audio contra el EPUB con <Code>faster-whisper</Code> + <Code>difflib</Code>, construir la página pública con streaming por Range y las fotos reinsertadas en su lugar.</li>
            <li>Si va a imprimirse físicamente y existe la página en línea: generar el código QR y la hoja de inserción aparte.</li>
          </ol>
          <Nota>
            Los scripts de subida a Storage (<Code>scripts/upload-inventar-mi-futuro*.js</Code>) y los
            componentes de la primera página sincronizada que se hizo (<Code>app/inventar-mi-futuro/</Code>,{' '}
            <Code>components/InventarMiFuturoClient.tsx</Code>) sirven de plantilla directa para el siguiente
            libro — copiarlos y adaptar rutas/datos por tenant, no reescribir desde cero.
          </Nota>
        </Seccion>
      </div>
    </div>
  );
}
