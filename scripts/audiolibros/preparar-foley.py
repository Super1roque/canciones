# Recorta cada sonido Foley a su parte útil y lo iguala a -3 dBFS de pico.
#
# Uso:
#   python3 scripts/audiolibros/preparar-foley.py <carpeta> <clips.json>
#
# clips.json: {"pala": {"dur": 3.5, "desde": 0.5}, "vespa": {"dur": 5, "desde": "centrar"}}
# Lee <carpeta>/efectos/<id>.mp3 y escribe <carpeta>/efectos/f-<id>.wav, más
# <carpeta>/clips-preparados.json con la duración real de cada uno (la usa el plan).
# "centrar" busca la ventana más fuerte del archivo: sirve para vehículos que pasan y para
# grabaciones con pausas (una máquina de escribir que se detiene en el segundo 10).
import json, subprocess, sys
import numpy as np

carpeta, config = sys.argv[1], json.load(open(sys.argv[2]))
SR = 22050

def muestras(archivo):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', archivo, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768

resultado = {}
for k, c in config.items():
    src = f'{carpeta}/efectos/{k}.mp3'
    x = muestras(src)
    total, dur, desde = len(x) / SR, c['dur'], c.get('desde', 0)
    if desde == 'centrar':
        ventana = int(0.5 * SR)
        energia = np.convolve(x ** 2, np.ones(ventana), 'valid')
        desde = max(0, min(energia.argmax() / SR - dur * 0.55, total - dur))
    dur = min(dur, total - desde)
    tramo = x[int(desde * SR): int((desde + dur) * SR)]
    ganancia = -3 - 20 * np.log10(np.abs(tramo).max() + 1e-9)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(desde), '-t', str(dur), '-i', src,
                    '-af', f'volume={ganancia:.1f}dB,afade=t=in:d=0.03,afade=t=out:st={max(0, dur - 0.3):.2f}:d=0.3',
                    '-ar', '44100', '-ac', '2', f'{carpeta}/efectos/f-{k}.wav'], check=True)
    resultado[k] = {'dur': round(dur, 2), 'desde': round(desde, 2)}
    aviso = '  ← grabación muy baja, revisar ruido' if ganancia > 30 else ''
    print(f'{k:14s} {dur:4.1f}s desde {desde:6.2f}s  ganancia {ganancia:+5.1f} dB{aviso}')
json.dump(resultado, open(f'{carpeta}/clips-preparados.json', 'w'), indent=1)
