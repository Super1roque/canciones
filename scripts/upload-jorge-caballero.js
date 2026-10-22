// Sube el audio de "50 años de servicio — Jorge Armando Caballero" a Firebase Storage.
// Uso: node --env-file=.env --env-file=.env.local scripts/upload-jorge-caballero.js
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
    local: '/Users/superroque/Desktop/ElevenLabs_2026-10-22T15_15_32_Hombre hispano mayor_ivc_sp100_s50_sb75_v4.mp3',
    remote: 'jorge-caballero/audio.mp3',
    contentType: 'audio/mpeg',
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
