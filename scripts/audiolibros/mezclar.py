# Mezcla la voz del audiolibro con música, cortinas, ambientes y Foley según <carpeta>/plan.json.
#
# Uso:
#   python3 scripts/audiolibros/mezclar.py <carpeta> <voz.mp3> <salida.mp3> [--solo-efectos]
#
# <carpeta>/plan.json es una lista de elementos:
#   {"archivo": "rio.mp3", "desde": 447.1, "hasta": 463.5, "volumen_db": -13,
#    "entrada": 2, "salida": 4, "sin_norma": false, "nota": "Cap. 2: el río"}
# y los archivos están en <carpeta>/efectos/.
#
# Cada efecto se repite si es más corto que su tramo, entra y sale con fundido, y baja
# automáticamente mientras habla el narrador (sidechain sobre la voz). Los ambientes y la
# música se igualan a -23 LUFS antes de aplicar volumen_db; los Foley ("sin_norma": true)
# ya vienen nivelados por pico desde preparar-foley.py, porque loudnorm no sirve con
# sonidos de menos de un segundo. El resultado se normaliza a -16 LUFS (Spotify, podcasts).
#
# --solo-efectos: escribe solo la pista de efectos ya atenuada por la voz, sin la voz ni la
# normalización final. Es lo que usa medir.py para comparar niveles.
import json, os, subprocess, sys

args = [a for a in sys.argv[1:] if not a.startswith('--')]
solo_efectos = '--solo-efectos' in sys.argv
carpeta, voz, salida = args
plan = json.load(open(os.path.join(carpeta, 'plan.json')))

cmd = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', voz]
filtros, etiquetas = [], []
for i, e in enumerate(plan, start=1):
    cmd += ['-stream_loop', '-1', '-i', os.path.join(carpeta, 'efectos', e['archivo'])]
    dur = e['hasta'] - e['desde']
    norma = '' if e.get('sin_norma') else 'loudnorm=I=-23:LRA=7,aresample=44100,'
    filtros.append(
        f"[{i}:a]aresample=44100,aformat=channel_layouts=stereo,atrim=0:{dur},asetpts=N/SR/TB,{norma}"
        f"afade=t=in:d={e['entrada']},afade=t=out:st={max(0, dur - e['salida'])}:d={e['salida']},"
        f"volume={e['volumen_db']}dB,adelay={int(e['desde'] * 1000)}:all=1[e{i}]")
    etiquetas.append(f'[e{i}]')
filtros.append(f"{''.join(etiquetas)}amix=inputs={len(plan)}:normalize=0:duration=longest[fx]")
filtros.append('[0:a]aresample=44100,aformat=channel_layouts=stereo,asplit=2[voz][guia]')
filtros.append('[fx][guia]sidechaincompress=threshold=0.05:ratio=3:attack=60:release=800[fxbajo]')
if solo_efectos:
    filtros.append('[voz]anullsink')
    filtros.append('[fxbajo]anull[out]')
else:
    filtros.append('[voz][fxbajo]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11[out]')
cmd += ['-filter_complex', ';'.join(filtros), '-map', '[out]', '-ar', '44100', '-b:a', '192k', salida]
subprocess.run(cmd, check=True)
print('mezcla lista:', salida)
