// Baja, sube y verifica los audios de los audiolibros en Firebase Storage.
//
// Uso (desde la raíz del repo):
//   node --env-file=.env --env-file=.env.local scripts/audiolibros/storage.js bajar jorge-caballero/audio.mp3 voz.mp3
//   node --env-file=.env --env-file=.env.local scripts/audiolibros/storage.js subir mezcla.mp3 jorge-caballero/audio.mp3
//   node --env-file=.env --env-file=.env.local scripts/audiolibros/storage.js md5 jorge-caballero/audio.mp3
//
// "subir" guarda antes una copia del audio actual como <nombre>-original-sin-efectos.mp3 (solo la
// primera vez, para no pisar el original con una mezcla) y al final compara el md5 de Storage con
// el del archivo local. Después hay que cambiar el ?v= de audioUrl en la página: la ruta de audio
// se sirve como immutable por un año y sin eso los navegadores seguirían con la versión vieja.
const crypto = require('crypto');
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

async function md5Remoto(remoto) {
  const [meta] = await bucket.file(remoto).getMetadata();
  return Buffer.from(meta.md5Hash, 'base64').toString('hex');
}

async function main() {
  const [comando, a, b] = process.argv.slice(2);
  if (comando === 'bajar') {
    await bucket.file(a).download({ destination: b });
    console.log(`bajado ${a} -> ${b}`);
  } else if (comando === 'subir') {
    const respaldo = bucket.file(b.replace(/\.mp3$/, '-original-sin-efectos.mp3'));
    const [existeRespaldo] = await respaldo.exists();
    const [existeActual] = await bucket.file(b).exists();
    if (!existeRespaldo && existeActual) {
      await bucket.file(b).copy(respaldo);
      console.log(`respaldo creado: ${respaldo.name}`);
    } else if (existeRespaldo) {
      console.log(`respaldo ya existía: ${respaldo.name}`);
    }
    await bucket.upload(a, { destination: b, metadata: { contentType: 'audio/mpeg' } });
    const local = crypto.createHash('md5').update(fs.readFileSync(a)).digest('hex');
    const remoto = await md5Remoto(b);
    console.log(`subido ${a} -> ${b}\nmd5 local   ${local}\nmd5 storage ${remoto}`);
    if (local !== remoto) throw new Error('El md5 no coincide: la subida no quedó bien');
  } else if (comando === 'md5') {
    console.log(await md5Remoto(a));
  } else {
    throw new Error('Comandos: bajar <remoto> <local> | subir <local> <remoto> | md5 <remoto>');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
