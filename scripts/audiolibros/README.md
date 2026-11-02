# Audiolibros: lector sincronizado, música, ambientes y Foley

Herramientas con las que se hicieron /inventar-mi-futuro, /ramon-villeda-morales y /jorge-caballero.
Se corren desde la raíz del repo. Node 20 (`export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`),
Python 3 con `faster-whisper` y `numpy`, y `ffmpeg`.

| Script | Para qué |
|---|---|
| `alinear-cues.py` | ePub + MP3 → `lib/<nombre>Cues.ts` del lector sincronizado |
| `cues-a-json.ts` | `lib/*Cues.ts` → JSON, para los scripts de Python |
| `freesound.mjs` | Buscar y bajar sonidos CC0 de Freesound, con créditos |
| `preparar-foley.py` | Recortar y nivelar por pico los sonidos Foley |
| `palabras.py` | Segundo exacto de cada frase que lleva un Foley |
| `mezclar.py` | Voz + `plan.json` → MP3 final a -16 LUFS |
| `medir.py` | Nivel de cada efecto respecto a la voz |
| `storage.js` | Bajar, subir (con respaldo del original) y verificar md5 en Storage |

## Proceso

1. **Cues.** `python3 scripts/audiolibros/alinear-cues.py libro.epub audio.mp3 lib/libroCues.ts cuesLibro`.
   Usar el ePub de narración, el mismo texto que se le dio a ElevenLabs. Revisar el porcentaje
   de palabras alineadas (96–98 % en los publicados) y los párrafos interpolados.
2. **Plan sonoro.** Carpeta de trabajo con `plan.json` y `efectos/`. Cada elemento:
   `{"archivo", "desde", "hasta", "volumen_db", "entrada", "salida", "sin_norma", "nota"}`.
   - Música de inicio (título y dedicatoria) y de cierre (legado).
   - Cortina de 5 s al inicio de cada encabezado (`kind: "heading"`), salvo donde ya suena música.
   - Ambientes solo en escenas que el texto describe. Ninguno en capítulos de listas ni en el de una muerte.
   - Foley: `palabras.py` da `fin_frase` y el sonido va en `fin_frase + 0.05` con `"sin_norma": true`.
3. **Sonidos.** `freesound.mjs buscar` → escuchar o leer la descripción → `freesound.mjs bajar carpeta nombre:id`.
   Para Foley, `preparar-foley.py carpeta clips.json` crea `efectos/f-<nombre>.wav`.
4. **Niveles.** `mezclar.py … --solo-efectos` y `medir.py`. Ajustar `volumen_db` hasta las metas:

   | Elemento | Meta |
   |---|---|
   | Ambientes | ~16 dB debajo de la voz |
   | Música | ~13 dB debajo |
   | Cortinas | ~10 dB debajo |
   | Multitudes, aplausos | ~9–10 dB debajo |
   | Foley | pico 5–8 dB sobre la voz media |

5. **Muestra.** Cortar con ffmpeg 5 s antes y 2–3 s después de cada momento nuevo, y aprobarla antes de publicar.
6. **Publicar.** `storage.js subir mezcla.mp3 <ruta>/audio.mp3` (respalda el original la primera vez y
   verifica el md5), cambiar el `?v=` de `audioUrl` en la página, commit solo de esa página, push, y
   comprobar el md5 de `https://corridos.online/api/<ruta>/audio?v=…`.

## Criterios

- Solo CC0: los audiolibros pueden ser patrocinados. Nunca la biblioteca de la BBC (no comercial).
  Descartar sonidos hechos con IA y los que no suenan a lo que el texto dice: mejor quitar el momento.
- Sin disparos ni violencia gráfica en fusilamientos o golpes de estado: tambor lejano o botas.
- No inventar detalles: si el texto no dice cómo viajó, viento, no avión.
- Pocos y justificados: ~1 Foley cada 2 minutos como máximo. Más que eso suena a radionovela.
- La duración del MP3 no cambia, así que los cues siguen valiendo después de mezclar.
- Guardar `creditos.txt` de cada libro (en el Escritorio del autor) por si un patrocinador los pide.

## Historias de Honduras (/historias)

Libros de pueblos, ciudades y lugares con una sola plantilla: `app/historias/[slug]/page.tsx` y el
índice `app/historias/page.tsx`. Un libro nuevo no lleva página ni rutas propias:

1. **Texto.** Solo datos verificables, con fuentes anotadas; lo que sea leyenda o tradición oral se dice como tal.
2. **Cues.** `alinear-cues.py libro.epub audio.mp3 lib/historias/<slug>Cues.ts cues<Nombre>` (mismo proceso de arriba).
3. **Fotos.** Subirlas a Storage como `historias/<slug>/fotos/00.jpg, 01.jpg…` y listarlas en `lib/historias/<slug>Imagenes.ts`
   con `src: '/api/historias/<slug>/foto/00.jpg'`. Portada para compartir: `public/historias/<slug>/portada.jpg` (1200×675).
4. **Audio.** `storage.js subir mezcla.mp3 historias/<slug>/audio.mp3`.
5. **Registro.** Agregar el libro a `HISTORIAS` en `lib/historias/index.ts` (slug, lugar, departamento, título,
   descripción, cues, duración, imágenes, `versionAudio`). Gratis por defecto.
6. **Venta (opcional).** Cortar `muestra.mp3` (hasta el fin del capítulo 1, con aviso hablado como en Morazán),
   subirla a `historias/<slug>/muestra.mp3`, llenar `muestra` en el registro, crear el producto en Hotmart con
   página de agradecimiento `https://corridos.online/historias/<slug>?compra=ok`, y en Render: `,<id>:<slug>` en
   `HOTMART_PRODUCTOS` y `HISTORIA_<SLUG>_CHECKOUT` (slug en mayúsculas, guiones como `_`). Sin esa variable, gratis.
