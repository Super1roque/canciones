# Encuentra el segundo exacto en que el narrador dice cada frase, para colocar los Foley.
#
# Uso:
#   python3 scripts/audiolibros/palabras.py <momentos.json> <voz.mp3> <cues.json>
#
# momentos.json: [{"id": "gradas", "cue": 53, "frase": "Subí las gradas"}, ...]
#   "cue" es el índice del párrafo en los cues del lector (cues-a-json.ts los exporta).
# Agrega a cada momento inicio_frase, fin_frase y parecido (0-1) y reescribe el archivo.
# El Foley se coloca 0.05 s después de fin_frase, para no tapar la palabra.
#
# Transcribe solo el párrafo de cada momento con faster-whisper (modelo small) y busca la
# frase por parecido con difflib: Whisper escribe «Colman», «bolinche» o parte «ajedrez» en
# dos, y la comparación exacta falló en 8 de 21 frases. Revisar a mano todo parecido < 0.9.
import difflib, json, os, re, subprocess, sys, tempfile, unicodedata
from faster_whisper import WhisperModel

archivo_momentos, voz, cues = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
momentos = json.load(open(archivo_momentos))

def normalizar(s):
    s = unicodedata.normalize('NFD', s.lower()).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9 ]', '', s).strip()

modelo = WhisperModel('small', device='cpu', compute_type='int8')
palabras_por_cue = {}
for m in momentos:
    c = cues[m['cue']]
    t0, t1 = c['start'] - 0.3, c['end'] + 0.3
    if m['cue'] not in palabras_por_cue:
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            wav = tmp.name
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(t0), '-to', str(t1), '-i', voz,
                        '-ar', '16000', '-ac', '1', wav], check=True)
        segmentos, _ = modelo.transcribe(wav, language='es', word_timestamps=True)
        palabras_por_cue[m['cue']] = [(normalizar(w.word), round(w.start + t0, 2), round(w.end + t0, 2))
                                      for s in segmentos for w in s.words if normalizar(w.word)]
        os.remove(wav)
    palabras = palabras_por_cue[m['cue']]
    objetivo = normalizar(m['frase']).split()

    def parecido(i):
        return sum(difflib.SequenceMatcher(None, palabras[i + j][0], o).ratio()
                   for j, o in enumerate(objetivo) if i + j < len(palabras)) / len(objetivo)

    i = max(range(len(palabras)), key=parecido)
    fin = palabras[min(i + len(objetivo) - 1, len(palabras) - 1)]
    m.update(inicio_frase=palabras[i][1], fin_frase=fin[2], parecido=round(parecido(i), 2))
    oido = ' '.join(p[0] for p in palabras[i:i + len(objetivo)])
    print(f"{m['id']:14s} {palabras[i][1]:8.2f}-{fin[2]:8.2f}  parecido {parecido(i):.2f}  «{oido}»", flush=True)

json.dump(momentos, open(archivo_momentos, 'w'), ensure_ascii=False, indent=1)
