// Exporta los cues de un lector sincronizado (lib/*Cues.ts) a JSON, para usarlos desde Python.
//
// Uso: npx tsx scripts/audiolibros/cues-a-json.ts lib/ramonVilledaMoralesCues.ts cues.json
import fs from 'node:fs';
import path from 'node:path';

const [archivo, salida] = process.argv.slice(2);
const modulo = require(path.resolve(archivo));
const cues = Object.values(modulo).find((v) => Array.isArray(v));
if (!cues) throw new Error(`No hay una lista de cues exportada en ${archivo}`);
fs.writeFileSync(salida, JSON.stringify(cues));
console.log(`${(cues as unknown[]).length} cues -> ${salida}`);
