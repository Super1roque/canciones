// Sube el audiolibro y la portada de "Inventar mi futuro — Crónica" a Firebase Storage.
// Uso: node --env-file=.env --env-file=.env.local scripts/upload-inventar-mi-futuro.js
const fs = require('fs');
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

const FILES = [
  {
    local: '/Users/superroque/Desktop/ElevenLabs_Inventar_mi_futuro_—_Crónica.mp3',
    remote: 'inventar-mi-futuro/cronica.mp3',
    contentType: 'audio/mpeg',
  },
  {
    local: '/Users/superroque/Desktop/portada-final.jpg',
    remote: 'inventar-mi-futuro/portada.jpg',
    contentType: 'image/jpeg',
  },
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
