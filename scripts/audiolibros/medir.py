# Mide cuánto suena cada elemento de plan.json respecto a la voz, para ajustar volumen_db.
#
# Uso:
#   python3 scripts/audiolibros/mezclar.py <carpeta> <voz.mp3> <carpeta>/fx.mp3 --solo-efectos
#   python3 scripts/audiolibros/medir.py <carpeta> <voz.mp3> <carpeta>/fx.mp3
#
# Metas aprobadas (dB por debajo de la voz): ambientes ~16, música ~13, cortinas ~10,
# multitudes y aplausos ~9-10. Los Foley se juzgan por el pico: entre 5 y 8 dB por encima
# del nivel medio de la voz. Para los Foley la voz se mide en los 6 s que lo rodean: si se
# midiera solo en su ventana y esta cae en una pausa, el número sale absurdo.
import json, re, subprocess, sys

carpeta, voz, fx = sys.argv[1:4]

def nivel(archivo, desde, dur, tipo='mean'):
    salida = subprocess.run(['ffmpeg', '-hide_banner', '-ss', str(max(0, desde)), '-t', str(dur), '-i', archivo,
                             '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.search(tipo + r'_volume: (-?[\d.]+)', salida).group(1))

vistos = set()
for e in json.load(open(carpeta + '/plan.json')):
    if e.get('sin_norma'):
        dur = max(0.4, e['hasta'] - e['desde'])
        v = nivel(voz, e['desde'] - 3, 6)
        media = v - nivel(fx, e['desde'], dur)
        pico = nivel(fx, e['desde'], dur, 'max') - v
        print(f"{e['nota'][:34]:34s} Foley    media {media:5.1f} dB debajo · pico {pico:+5.1f} dB sobre la voz media")
        continue
    if e['archivo'] in vistos:  # las cortinas se repiten: basta medir la primera
        continue
    vistos.add(e['archivo'])
    dur = min(8, e['hasta'] - e['desde'])
    desde = (e['desde'] + e['hasta']) / 2 - dur / 2
    print(f"{e['nota'][:34]:34s} ambiente {nivel(voz, desde, dur) - nivel(fx, desde, dur):5.1f} dB debajo de la voz")
