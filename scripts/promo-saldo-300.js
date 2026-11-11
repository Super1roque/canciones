// Promo (ver lib/promo.ts): deja a todos los tenants como premium y con al
// menos L 300 de saldo. A quien ya tiene más de 300 no se le baja — es saldo
// que pagó. Sin --aplicar solo muestra lo que cambiaría.
// Uso: node --env-file=.env --env-file=.env.local scripts/promo-saldo-300.js [--aplicar]
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();
const SALDO = 300;
const aplicar = process.argv.includes('--aplicar');

async function main() {
  const snap = await db.collection('tenants').get();
  const cambios = [];
  let yaEstaban = 0, conMas = 0;
  snap.forEach((doc) => {
    const t = doc.data();
    const saldo = t.saldo ?? 0;
    const datos = {};
    if (saldo < SALDO) datos.saldo = SALDO;
    if (saldo > SALDO) conMas++;
    if (t.plan !== 'premium') datos.plan = 'premium';
    if (Object.keys(datos).length) cambios.push({ ref: doc.ref, telefono: doc.id, antes: { saldo, plan: t.plan ?? 'freemium' }, datos });
    else yaEstaban++;
  });

  console.log(`Tenants: ${snap.size} · a cambiar: ${cambios.length} · ya estaban bien: ${yaEstaban} · con más de L ${SALDO} (se respeta): ${conMas}`);
  console.log(`Suben a L ${SALDO}: ${cambios.filter(c => c.datos.saldo).length} · pasan a premium: ${cambios.filter(c => c.datos.plan).length}`);
  if (!aplicar) { console.log('Modo prueba: no se escribió nada. Repetir con --aplicar.'); return; }

  // Lotes de 400 (el límite de Firestore es 500 escrituras por lote).
  for (let i = 0; i < cambios.length; i += 400) {
    const lote = db.batch();
    cambios.slice(i, i + 400).forEach(c => lote.update(c.ref, c.datos));
    await lote.commit();
  }
  console.log(`Listo: ${cambios.length} tenants actualizados.`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
