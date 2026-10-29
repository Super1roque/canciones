// Busca y descarga sonidos CC0 de Freesound para los audiolibros.
//
// Uso (desde la raíz del repo; la clave FREESOUND_API_KEY está en .env.local):
//   node --env-file=.env.local scripts/audiolibros/freesound.mjs buscar "church bell" [cantidad]
//   node --env-file=.env.local scripts/audiolibros/freesound.mjs ver 329324
//   node --env-file=.env.local scripts/audiolibros/freesound.mjs bajar <carpeta> rio:433589 fogata:62487 ...
//
// "bajar" guarda <carpeta>/efectos/<nombre>.mp3 y anota el crédito en <carpeta>/creditos.txt.
// Solo acepta licencia CC0 (uso comercial sin atribución obligatoria): los audiolibros
// pueden ser patrocinados. Se descarga la vista previa HQ (MP3 ~128 kbps), que alcanza para
// sonidos que van debajo de la voz; el original pediría OAuth.
import fs from 'node:fs';

const KEY = process.env.FREESOUND_API_KEY;
if (!KEY) {
  console.error('Falta FREESOUND_API_KEY en .env.local');
  process.exit(1);
}
const API = 'https://freesound.org/apiv2';
const [, , comando, ...args] = process.argv;

async function sonido(id, campos = 'id,name,username,license,url,duration,description,previews') {
  const r = await fetch(`${API}/sounds/${id}/?fields=${campos}&token=${KEY}`);
  if (!r.ok) throw new Error(`Freesound ${r.status} para ${id}`);
  return r.json();
}

if (comando === 'buscar') {
  const [consulta, cantidad = '6'] = args;
  const url = new URL(`${API}/search/text/`);
  url.searchParams.set('query', consulta);
  url.searchParams.set('filter', 'license:"Creative Commons 0" duration:[0.3 TO 240]');
  url.searchParams.set('fields', 'id,name,duration,avg_rating,num_ratings,num_downloads,description');
  url.searchParams.set('sort', 'downloads_desc');
  url.searchParams.set('page_size', cantidad);
  url.searchParams.set('token', KEY);
  const j = await (await fetch(url)).json();
  console.log(`${j.count} resultados CC0 para «${consulta}»`);
  for (const s of j.results || []) {
    const desc = s.description.replace(/\s+/g, ' ').slice(0, 90);
    console.log(`  ${s.id} | ${s.duration.toFixed(1)}s | ★${(s.avg_rating || 0).toFixed(1)}(${s.num_ratings}) | ${s.num_downloads}↓ | ${s.name.slice(0, 40)} | ${desc}`);
  }
} else if (comando === 'ver') {
  const s = await sonido(args[0]);
  console.log(`${s.id} «${s.name}» de ${s.username} · ${s.duration.toFixed(1)}s · ${s.license}\n${s.url}\n${s.description}`);
} else if (comando === 'bajar') {
  const [carpeta, ...pares] = args;
  fs.mkdirSync(`${carpeta}/efectos`, { recursive: true });
  for (const par of pares) {
    const [nombre, id] = par.split(':');
    const s = await sonido(id);
    if (!s.license.includes('publicdomain/zero')) throw new Error(`${id} no es CC0: ${s.license}`);
    const audio = Buffer.from(await (await fetch(s.previews['preview-hq-mp3'])).arrayBuffer());
    fs.writeFileSync(`${carpeta}/efectos/${nombre}.mp3`, audio);
    fs.appendFileSync(`${carpeta}/creditos.txt`, `${nombre}: "${s.name}" de ${s.username} — ${s.license} — ${s.url}\n`);
    console.log(`ok ${nombre} (${(audio.length / 1024).toFixed(0)} KB)`);
  }
} else {
  console.error('Comandos: buscar <consulta> [cantidad] | ver <id> | bajar <carpeta> nombre:id ...');
  process.exit(1);
}
