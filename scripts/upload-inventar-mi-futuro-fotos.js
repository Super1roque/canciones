// Sube las fotos de "Inventar mi futuro — Crónica" a Firebase Storage.
// Uso: node --env-file=.env --env-file=.env.local scripts/upload-inventar-mi-futuro-fotos.js
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

const LOCAL_DIR = '/private/tmp/claude-502/-Users-superroque-canciones/ca7a5e72-820e-4f04-8a2c-d56b82a89616/scratchpad/fotos-cronica-publicadas';

async function main() {
  const files = fs.readdirSync(LOCAL_DIR).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
  files.sort();
  console.log(`Subiendo ${files.length} fotos...`);
  for (const f of files) {
    const local = path.join(LOCAL_DIR, f);
    const remote = `inventar-mi-futuro/fotos/${f}`;
    const contentType = f.endsWith('.png') ? 'image/png' : 'image/jpeg';
    await bucket.upload(local, {
      destination: remote,
      metadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
    });
    console.log(`  ✓ ${f}`);
  }
  console.log('Todo subido.');
}

main().catch((err) => {
  console.error('Error subiendo fotos:', err);
  process.exit(1);
});
