import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Guía: audiolibros con música, ambientes y Foley',
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

function Tabla({ filas, encabezado }: { encabezado: string[]; filas: React.ReactNode[][] }) {
  const celda = { padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border)', textAlign: 'left' as const, verticalAlign: 'top' as const };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
        <thead>
          <tr>{encabezado.map((h) => <th key={h} style={{ ...celda, color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((f, i) => <tr key={i}>{f.map((c, j) => <td key={j} style={celda}>{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

const PROMPT = `Tengo listo el audiolibro de [NOMBRE DEL LIBRO].
- ePub de narración: ~/Desktop/[nombre].epub
- MP3: ~/Desktop/[nombre].mp3
- Página: [nueva en corridos.online/NOMBRE, o la que ya existe en corridos.online/NOMBRE]

Lee scripts/audiolibros/README.md en canciones y haz lo mismo que con
Inventar mi futuro, Ramón Villeda y Jorge Caballero:
1. Alinea el texto con el audio para el lector sincronizado.
2. Música de inicio y cierre, cortinas en todos los capítulos, ambientes en las
   escenas y Foley en las acciones, con sonidos CC0 de Freesound y las mismas
   metas de nivel.
3. Pásame una muestra de los momentos con efectos antes de publicar.
4. Cuando la apruebe, publícala con commit y push.`;

const SECCIONES = [
  { id: 'resumen', titulo: 'Resumen' },
  { id: 'paso-1', titulo: '1. Preparar el ePub de narración' },
  { id: 'paso-2', titulo: '2. Generar el audio en ElevenLabs' },
  { id: 'paso-3', titulo: '3. Pedirle a Claude el resto' },
  { id: 'capas', titulo: 'Las capas de sonido' },
  { id: 'criterios', titulo: 'Criterios' },
  { id: 'niveles', titulo: 'Metas de nivel' },
  { id: 'scripts', titulo: 'Los scripts' },
  { id: 'publicar', titulo: 'Publicar y verificar' },
  { id: 'deshacer', titulo: 'Volver al audio original' },
  { id: 'publicados', titulo: 'Audiolibros ya hechos' },
];

export default function GuiaAudiolibrosPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <header className="header">
        <div className="header-inner">
          <div className="logo"><span className="logo-icon">🎧</span><span className="logo-text">Canciones</span></div>
          <a href="/admin" className="nav-btn">← Volver</a>
        </div>
      </header>

      <style>{`
        .guia-contenido p, .guia-contenido ul, .guia-contenido ol {
          margin-bottom: 0.9rem;
        }
        .guia-contenido p:last-child, .guia-contenido ul:last-child, .guia-contenido ol:last-child {
          margin-bottom: 0;
        }
      `}</style>
      <div className="guia-contenido" style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1.5rem 6rem' }}>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 700, marginBottom: '0.4rem' }}>🎧 Audiolibros con música, ambientes y Foley</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: 1.6 }}>
          Cómo pasar de un ePub y un MP3 de ElevenLabs a un audiolibro publicado con lector sincronizado,
          música, cortinas, ambientes y Foley, como /inventar-mi-futuro, /ramon-villeda-morales y
          /jorge-caballero. Complementa la <a href="/admin/guia-libros" style={{ color: 'var(--accent-soft)' }}>guía
          para producir un libro</a> (fases 4, 5 y 8). Si el proceso cambia, actualizar este archivo
          (<Code>app/admin/guia-audiolibros/page.tsx</Code>) y <Code>scripts/audiolibros/README.md</Code>.
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
            {SECCIONES.map((s) => (
              <a key={s.id} href={`#${s.id}`} style={{ fontSize: '0.86rem', color: 'var(--accent-soft)', textDecoration: 'none' }}>
                {s.titulo}
              </a>
            ))}
          </div>
        </nav>

        <Seccion id="resumen" titulo="Resumen">
          <p>
            El autor hace tres cosas: pedir el ePub de narración, generar el audio en ElevenLabs y pegarle
            a Claude un prompt. Claude hace el resto con los scripts de <Code>scripts/audiolibros/</Code>:
            alinea el texto con la voz, busca sonidos libres, los coloca, mide los niveles, entrega una
            muestra y publica cuando el autor la aprueba.
          </p>
        </Seccion>

        <Seccion id="paso-1" titulo="1. Preparar el ePub de narración">
          <p>
            Pedirle a Claude: <em>&quot;prepara el ePub de narración de [libro]&quot;</em>. Tiene que ser el mismo
            texto que se le da a ElevenLabs, porque el lector sincronizado se arma comparando ese texto con
            lo que el narrador dice. El ePub de lectura no sirve: trae pies de foto, &quot;Dato destacado&quot;,
            fuentes y cronología, que no se narran y no se pueden alinear.
          </p>
          <ul style={{ paddingLeft: '1.3rem' }}>
            <li>Solo el texto que se lee en voz alta.</li>
            <li>Si se usa Eleven v3, puede llevar etiquetas de tono (<Code>[warmly]</Code>, <Code>[solemnly]</Code>…): no afectan la alineación.</li>
          </ul>
        </Seccion>

        <Seccion id="paso-2" titulo="2. Generar el audio en ElevenLabs">
          <ul style={{ paddingLeft: '1.3rem' }}>
            <li>Usar el texto tal cual. Si se cambia algo allá, avisarle a Claude.</li>
            <li>Descargar un solo MP3, o varios numerados (<Code>01.mp3</Code>, <Code>02.mp3</Code>…) y Claude los une.</li>
            <li>Escuchar que no se salte frases: en Villeda, ElevenLabs omitió la segunda aparición de «¡Siempre adelante, ni un paso atrás!». El alineador lo detecta, pero mejor saberlo antes.</li>
            <li>Revisar la pronunciación de nombres propios y agregarlos al diccionario del proyecto si suenan mal.</li>
          </ul>
          <Tabla
            encabezado={['', 'Multilingual v2', 'Eleven v3']}
            filas={[
              ['Cuándo', 'Textos largos, tono parejo', 'Más expresivo, por bloques'],
              ['Pausas', <Code key="b">{'<break time="1s" />'}</Code>, 'Puntos suspensivos y saltos de línea'],
              ['Emoción', 'Estabilidad 55–65 %, estilo 0–15 %, velocidad 0.90–0.95', <span key="t">Etiquetas en inglés: <Code>[warmly]</Code>, <Code>[thoughtful]</Code>, <Code>[dramatic]</Code>…</span>],
              ['Estabilidad', '—', 'Natural para tono sobrio; Creative si sale plano'],
              ['Largo', 'Capítulo entero', 'Capítulos largos en 2–3 bloques'],
            ]}
          />
          <Nota>
            Si en v3 sale corrido y sin emoción: frases cortas en líneas separadas, etiquetas que digan cómo
            decirlo (<Code>[slowly]</Code>, <Code>[with emphasis]</Code>), una palabra clave en MAYÚSCULAS y
            estabilidad Creative. Para un tono solemne de acto cívico: <Code>[solemnly]</Code>,{' '}
            <Code>[with gravitas]</Code>, frases largas y estabilidad Natural. La admin de{' '}
            <a href="/admin/prompts-elevenlabs" style={{ color: 'var(--accent-soft)' }}>Prompts para ElevenLabs</a> convierte un texto a etiquetas de v3.
          </Nota>
        </Seccion>

        <Seccion id="paso-3" titulo="3. Pedirle a Claude el resto">
          <p>
            Poner los archivos en el Escritorio, abrir Claude Code desde la carpeta personal
            (<Code>/Users/superroque</Code>, donde está su memoria del proceso) y pegar:
          </p>
          <Bloque>{PROMPT}</Bloque>
          <p>
            Si la página es nueva, decir también la imagen para compartir (la portada siempre va primero y es
            la miniatura) y el texto del botón final.
          </p>
        </Seccion>

        <Seccion id="capas" titulo="Las capas de sonido">
          <Tabla
            encabezado={['Capa', 'Dónde va', 'Ejemplo']}
            filas={[
              ['Música', 'Título y dedicatoria; cierre (legado)', 'Guitarra «Folk Guitar Music Track»; piano en Jorge Caballero'],
              ['Cortinas', '5 s al inicio de cada capítulo, salvo donde ya suena música', '22 en Inventar mi futuro, 14 en Villeda'],
              ['Ambientes', 'Solo en escenas que el texto describe', 'Río, fogata, estadio, Berlín, campanas del funeral'],
              ['Foley', 'Acciones físicas nombradas, 0.05 s después de la palabra', 'Willys arrancando, botella de Cinzano, máquina de escribir'],
            ]}
          />
          <p style={{ marginTop: '0.9rem' }}>
            Ni ambientes ni Foley en capítulos de listas (leyes, publicaciones) ni en el de una muerte, que
            lleva solo su cortina.
          </p>
        </Seccion>

        <Seccion id="criterios" titulo="Criterios">
          <ul style={{ paddingLeft: '1.3rem' }}>
            <li><strong>Solo sonidos CC0</strong> de Freesound: uso comercial sin atribución obligatoria. Nunca la biblioteca de la BBC (no permite uso comercial). Igual se guardan los créditos de cada libro.</li>
            <li><strong>Descartar</strong> sonidos generados con IA y los que no suenan a lo que el texto dice: mejor quitar el momento (pasó con las metras, las tarjetas perforadas y el féretro).</li>
            <li><strong>Sin disparos ni violencia gráfica</strong> en fusilamientos o golpes de estado: tambor lejano o botas.</li>
            <li><strong>No inventar detalles</strong>: si el texto no dice cómo viajó, viento, no avión.</li>
            <li><strong>Pocos y justificados</strong>: alrededor de un Foley cada 2 minutos como máximo. Más que eso suena a radionovela.</li>
            <li><strong>La duración del MP3 no cambia</strong>, así que el texto sincronizado sigue valiendo después de mezclar.</li>
          </ul>
        </Seccion>

        <Seccion id="niveles" titulo="Metas de nivel">
          <Tabla
            encabezado={['Elemento', 'Meta']}
            filas={[
              ['Ambientes', '~16 dB debajo de la voz'],
              ['Música', '~13 dB debajo'],
              ['Cortinas', '~10 dB debajo'],
              ['Multitudes y aplausos', '~9–10 dB debajo'],
              ['Foley', 'Pico 5–8 dB sobre el nivel medio de la voz (medida en los 6 s que lo rodean)'],
              ['Mezcla final', '-16 LUFS, pico -1.5 dB (Spotify, podcasts)'],
            ]}
          />
          <Nota>
            Se miden, no se ajustan a oído: la primera mezcla de Villeda dejó los efectos entre 14 y 26 dB bajo
            la voz y casi no se oían. Los efectos bajan solos cuando habla el narrador (sidechain suave).
          </Nota>
        </Seccion>

        <Seccion id="scripts" titulo="Los scripts">
          <Tabla
            encabezado={['Script', 'Para qué']}
            filas={[
              [<Code key="1">alinear-cues.py</Code>, 'ePub + MP3 → lib/<nombre>Cues.ts del lector sincronizado'],
              [<Code key="2">cues-a-json.ts</Code>, 'Los cues a JSON, para los scripts de Python'],
              [<Code key="3">freesound.mjs</Code>, 'Buscar y bajar sonidos CC0, con créditos'],
              [<Code key="4">preparar-foley.py</Code>, 'Recortar y nivelar por pico los Foley'],
              [<Code key="5">palabras.py</Code>, 'Segundo exacto de cada frase que lleva un Foley'],
              [<Code key="6">mezclar.py</Code>, 'Voz + plan.json → MP3 final'],
              [<Code key="7">medir.py</Code>, 'Nivel de cada efecto respecto a la voz'],
              [<Code key="8">storage.js</Code>, 'Bajar, subir con respaldo y verificar md5 en Storage'],
            ]}
          />
          <p style={{ marginTop: '0.9rem' }}>
            Detalle de uso en <Code>scripts/audiolibros/README.md</Code>. Probados contra lo publicado:
            <Code>mezclar.py</Code> reproduce bit por bit el audio de Jorge Caballero y{' '}
            <Code>alinear-cues.py</Code> los cues de Villeda (96.1 % de palabras, 0.08 s de diferencia media).
            La clave de Freesound va en <Code>.env.local</Code> como <Code>FREESOUND_API_KEY</Code>.
          </p>
        </Seccion>

        <Seccion id="publicar" titulo="Publicar y verificar">
          <ol style={{ paddingLeft: '1.3rem' }}>
            <li>Muestra corta con los momentos nuevos (5 s antes y 2–3 s después de cada uno). El autor la aprueba.</li>
            <li><Code>storage.js subir</Code>: respalda el original como <Code>…-original-sin-efectos.mp3</Code> la primera vez y compara el md5.</li>
            <li>Cambiar el <Code>?v=</Code> de <Code>audioUrl</Code> en la página: la ruta de audio se sirve como immutable por un año y sin esto los navegadores seguirían con la versión vieja.</li>
            <li>Commit solo de esa página (nunca <Code>lib/prompts.ts</Code> ni archivos ajenos) y push. Render despliega en 2–3 minutos.</li>
            <li>Comparar el md5 de <Code>https://corridos.online/api/&lt;ruta&gt;/audio?v=…</Code> con el de la mezcla.</li>
          </ol>
        </Seccion>

        <Seccion id="deshacer" titulo="Volver al audio original">
          <p>Cada audiolibro guarda en Storage su versión sin efectos. Para volver a ella:</p>
          <Bloque>{`node --env-file=.env --env-file=.env.local scripts/audiolibros/storage.js bajar <ruta>/audio-original-sin-efectos.mp3 original.mp3
node --env-file=.env --env-file=.env.local scripts/audiolibros/storage.js subir original.mp3 <ruta>/audio.mp3`}</Bloque>
          <p>y cambiar el <Code>?v=</Code> de la página. En Inventar mi futuro el archivo se llama <Code>inventar-mi-futuro/cronica.mp3</Code>.</p>
        </Seccion>

        <Seccion id="publicados" titulo="Audiolibros ya hechos">
          <Tabla
            encabezado={['Audiolibro', 'Duración', 'Música y cortinas', 'Ambientes', 'Foley']}
            filas={[
              [<a key="a" href="/inventar-mi-futuro" style={{ color: 'var(--accent-soft)' }}>Inventar mi futuro</a>, '45 min', 'Guitarra, 22 cortinas', '10', '20'],
              [<a key="b" href="/ramon-villeda-morales" style={{ color: 'var(--accent-soft)' }}>Ramón Villeda Morales</a>, '21 min', 'Guitarra, 14 cortinas', '12', '8'],
              [<a key="c" href="/jorge-caballero" style={{ color: 'var(--accent-soft)' }}>Jorge Caballero</a>, '3 min', 'Piano', '2', '5'],
            ]}
          />
        </Seccion>
      </div>
    </div>
  );
}
