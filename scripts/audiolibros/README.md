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
