// Sube el audiolibro y las fotos de "Siempre adelante, ni un paso atrás — Ramón Villeda Morales" a Firebase Storage.
// Uso: node --env-file=.env --env-file=.env.local scripts/upload-ramon-villeda-morales.js
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

const bucket = admin.storage().bucket();

const AUDIO = '/Users/superroque/Desktop/ElevenLabs_Siempre_adelante,_ni_un_paso_atrás.mp3';
// 00 retrato al óleo, 01 con su familia, 02 con Kennedy, 03 con Modesto Rodas Alvarado (máx. 900px)
const FOTOS_DIR = '/private/tmp/claude-502/-Users-superroque/7bb66ff1-e60b-49e3-8969-4e7a9776db1a/scratchpad/villeda/fotos';

const FILES = [
  { local: AUDIO, remote: 'ramon-villeda-morales/audio.mp3', contentType: 'audio/mpeg' },
  ...fs.readdirSync(FOTOS_DIR)
    .filter((f) => /^[0-9]{2}\.jpg$/.test(f))
    .sort()
    .map((f) => ({ local: path.join(FOTOS_DIR, f), remote: `ramon-villeda-morales/fotos/${f}`, contentType: 'image/jpeg' })),
];

async function main() {
  for (const f of FILES) {
    console.log(`Subiendo ${f.local} -> gs://${bucket.name}/${f.remote} ...`);
    await bucket.upload(f.local, {
      destination: f.remote,
      metadata: { contentType: f.contentType, cacheControl: 'public, max-age=31536000, immutable' },
    });
    console.log(`  ✓ listo`);
  }
  console.log('Todo subido.');
}

main().catch((err) => {
  console.error('Error subiendo archivos:', err);
  process.exit(1);
});
