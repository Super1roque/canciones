// Al pasar la descarga a "por canción" (11 nov 2026), deja habilitadas las
// canciones de quienes ya eran premium por haber pagado saldo: los tenants
// con algún pedido cobrado (costo > 0) antes de la promo. Sin --aplicar solo
// muestra lo que cambiaría.
// Uso: node --env-file=.env --env-file=.env.local scripts/descarga-pagadas-antes.js [--aplicar]
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();
const INICIO_PROMO = '2026-11-11';
const aplicar = process.argv.includes('--aplicar');

async function main() {
  const pedidos = (await db.collection('pedidos').get()).docs.map(d => d.data());
  const pagaron = new Set(pedidos.filter(p => (p.costo ?? 0) > 0 && p.fecha < INICIO_PROMO).map(p => p.telefono));
  const ids = pedidos.filter(p => p.cancionCompartidaId && pagaron.has(p.telefono)).map(p => p.cancionCompartidaId);

  console.log(`Tenants que pagaron antes de la promo: ${[...pagaron].join(', ')}`);
  console.log(`Canciones a habilitar: ${ids.length}`);
  if (!aplicar) { console.log('Modo prueba: no se escribió nada. Repetir con --aplicar.'); return; }

  const lote = db.batch();
  for (const id of ids) lote.update(db.collection('canciones_compartidas').doc(id), { descargaHabilitada: true });
  await lote.commit();
  console.log(`Listo: ${ids.length} canciones con descarga habilitada.`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
