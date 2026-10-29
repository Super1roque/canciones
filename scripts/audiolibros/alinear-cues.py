# Genera los cues del lector sincronizado (lib/<nombre>Cues.ts) alineando el texto del ePub con el MP3.
#
# Uso:
#   python3 scripts/audiolibros/alinear-cues.py <libro.epub> <audio.mp3> <lib/salidaCues.ts> <nombreExport>
#   ej.: ... morazan.epub morazan.mp3 lib/morazanCues.ts cuesMorazan
#
# Pasos: lee los párrafos del ePub en el orden del spine (h1/h2 = encabezado, .dek = bajada,
# p/li/blockquote = párrafo; un p.kicker se une al título siguiente: «Capítulo uno. El lugar…»),
# transcribe todo el audio con faster-whisper (palabra por palabra) y alinea las dos listas de
# palabras con difflib. Cada párrafo toma el tiempo de su primera y su última palabra halladas.
# Imprime el porcentaje de palabras alineadas (los libros publicados quedaron entre 96 y 98 %)
# y avisa de los párrafos sin ninguna coincidencia, que se interpolan entre sus vecinos.
# Usar el ePub de narración (el mismo texto que se le dio a ElevenLabs), no el de lectura con
# pies de foto: lo que no se narra no se puede alinear.
import difflib, json, os, re, subprocess, sys, unicodedata, zipfile
from html import unescape
from faster_whisper import WhisperModel

epub, audio, salida, nombre = sys.argv[1:5]

def normalizar(s):
    s = unicodedata.normalize('NFD', s.lower()).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9 ]', ' ', s).split()

def texto(html):
    return re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', '', html))).strip()

# --- 1. Párrafos del ePub, en orden ---
z = zipfile.ZipFile(epub)
opf_nombre = next(n for n in z.namelist() if n.endswith('.opf'))
opf = z.read(opf_nombre).decode()
base = opf_nombre.rsplit('/', 1)[0] + '/' if '/' in opf_nombre else ''
hrefs = dict(re.findall(r'<item [^>]*id="([^"]+)"[^>]*href="([^"]+)"', opf))
hrefs.update({i: h for h, i in re.findall(r'<item [^>]*href="([^"]+)"[^>]*id="([^"]+)"', opf)})
parrafos, kicker = [], ''
for idref in re.findall(r'<itemref [^>]*idref="([^"]+)"', opf):
    cuerpo = z.read(base + hrefs[idref]).decode().split('<body', 1)[-1]
    cuerpo = re.sub(r'<figure.*?</figure>', '', cuerpo, flags=re.S)
    for etiqueta, attrs, contenido in re.findall(r'<(h1|h2|h3|p|li|blockquote)([^>]*)>(.*?)</\1>', cuerpo, flags=re.S):
        t = texto(contenido)
        if not t:
            continue
        clase = re.search(r'class="([^"]*)"', attrs)
        clase = clase.group(1) if clase else ''
        if 'kicker' in clase:
            kicker = t
            continue
        if etiqueta in ('h1', 'h2'):
            parrafos.append({'text': f'{kicker}. {t}' if kicker else t, 'kind': 'heading'})
            kicker = ''
        else:
            parrafos.append({'text': t, 'kind': 'dek' if 'dek' in clase else 'p'})

# --- 2. Palabras del audio, con tiempo ---
# La transcripción se guarda junto al audio (<audio>.palabras.json) y se reutiliza: repetir
# una alineación después de corregir el ePub no obliga a transcribir de nuevo.
cache = audio + '.palabras.json'
if os.path.exists(cache):
    oidas = [tuple(o) for o in json.load(open(cache))]
    print(f'{len(parrafos)} párrafos en el ePub; transcripción reutilizada de {cache}')
else:
    print(f'{len(parrafos)} párrafos en el ePub; transcribiendo el audio (tarda varios minutos)...', flush=True)
    modelo = WhisperModel('small', device='cpu', compute_type='int8')
    segmentos, _ = modelo.transcribe(audio, language='es', word_timestamps=True)
    oidas = [(token, w.start, w.end) for s in segmentos for w in s.words for token in normalizar(w.word)]
    json.dump(oidas, open(cache, 'w'))
duracion = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', audio],
                                capture_output=True, text=True).stdout)

# --- 3. Alineación ---
escritas, dueño = [], []
for i, p in enumerate(parrafos):
    for token in normalizar(p['text']):
        escritas.append(token)
        dueño.append(i)
tiempo = [None] * len(escritas)
emparejador = difflib.SequenceMatcher(None, escritas, [o[0] for o in oidas], autojunk=False)
for a, b, n in emparejador.get_matching_blocks():
    for k in range(n):
        tiempo[a + k] = oidas[b + k][1:]
print(f'palabras alineadas: {100 * sum(t is not None for t in tiempo) / len(escritas):.1f} %')

cues = []
for i, p in enumerate(parrafos):
    t = [tiempo[k] for k in range(len(escritas)) if dueño[k] == i and tiempo[k]]
    cues.append({'start': round(t[0][0], 2) if t else None, 'end': round(t[-1][1], 2) if t else None, **p})
for i, c in enumerate(cues):
    if c['start'] is not None:
        continue
    # Sin coincidencias en la alineación global: pasa con frases que se repiten en el libro
    # («¡Siempre adelante, ni un paso atrás!» sale tres veces) y difflib empareja otra
    # aparición. Se busca de nuevo solo en el audio entre el párrafo anterior y el siguiente.
    antes = next((x['start'] for x in reversed(cues[:i]) if x['start'] is not None), 0)
    despues = next((x['start'] for x in cues[i + 1:] if x['start'] is not None), duracion)
    ventana = [o for o in oidas if antes <= o[1] < despues]
    propias = normalizar(c['text'])
    bloques = difflib.SequenceMatcher(None, propias, [o[0] for o in ventana], autojunk=False).get_matching_blocks()
    halladas = [ventana[b + k] for a, b, n in bloques for k in range(n)]
    if halladas:
        c['start'], c['end'] = round(halladas[0][1], 2), round(halladas[-1][2], 2)
        print(f'  hallado en su tramo: «{c["text"][:60]}»')
    else:
        anterior = next((x['end'] for x in reversed(cues[:i]) if x['end'] is not None), 0)
        c['start'], c['end'] = anterior, despues
        print(f'  sin coincidencias, interpolado: «{c["text"][:60]}»')
for a, b in zip(cues, cues[1:]):  # sin solapes: cada uno termina donde empieza el siguiente si se cruzan
    if a['end'] > b['start']:
        a['end'] = b['start']
cues[0]['start'] = 0.0

with open(salida, 'w') as f:
    f.write('// Generado por scripts/audiolibros/alinear-cues.py: texto del ePub alineado contra el audio\n')
    f.write('// (faster-whisper + difflib). No editar a mano salvo errores puntuales.\n')
    f.write("import type { CuePárrafo } from './inventarMiFuturoCues';\n\n")
    f.write(f'export const {nombre}: CuePárrafo[] = {json.dumps(cues, ensure_ascii=False, indent=2)};\n\n')
    f.write(f'export const duracionTotalSegundos = {round(duracion, 2)};\n')
print(f'{len(cues)} cues -> {salida}')
