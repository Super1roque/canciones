import admin from 'firebase-admin';

function initApp() {
  if (admin.apps.length) return;
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
    ...(process.env.FIREBASE_STORAGE_BUCKET ? { storageBucket: process.env.FIREBASE_STORAGE_BUCKET } : {}),
  });
}

function getDb() {
  initApp();
  return admin.firestore();
}

function getStorageBucket() {
  initApp();
  if (!process.env.FIREBASE_STORAGE_BUCKET) {
    throw new Error('FIREBASE_STORAGE_BUCKET no está configurado en .env.local');
  }
  return admin.storage().bucket();
}

export { getDb, getStorageBucket };
