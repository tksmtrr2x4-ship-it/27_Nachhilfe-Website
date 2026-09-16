// Vergleicht zwei MongoDB-Datenbanken: Collections, Optionen, Indizes, Dokumente (Hash).
// Aufruf (als root, auf dem Server /usr/local/bin/lernsprung-compare-dbs.cjs):
// SRC_URI, DST_URI, DB_NAME und optional DST_DB_NAME aus der Umgebung. Gibt nie Verbindungsdaten aus.
const { createRequire } = require("module");
const req = createRequire("/var/www/lernsprung/package.json");
const { MongoClient, BSON } = req("mongodb");
const crypto = require("crypto");

async function describe(uri, dbName) {
  const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 15000 });
  try {
    const db = client.db(dbName);
    const out = {};
    const colls = (await db.listCollections().toArray()).filter((c) => !c.name.startsWith("system."));
    for (const c of colls.sort((a, b) => a.name.localeCompare(b.name))) {
      const coll = db.collection(c.name);
      const hash = crypto.createHash("sha256");
      let count = 0;
      for await (const doc of coll.find({}).sort({ _id: 1 })) {
        hash.update(BSON.EJSON.stringify(doc, { relaxed: false }));
        hash.update("\n");
        count++;
      }
      const indexes = (await coll.indexes())
        .map(({ v, ns, ...rest }) => JSON.stringify(rest, Object.keys(rest).sort()))
        .sort();
      const { uuid, ...options } = { ...(c.options || {}) };
      out[c.name] = { type: c.type, count, sha256: hash.digest("hex"), indexes, options: JSON.stringify(options) };
    }
    return out;
  } finally {
    await client.close();
  }
}

(async () => {
  const name = process.env.DB_NAME;
  const [a, b] = await Promise.all([describe(process.env.SRC_URI, name), describe(process.env.DST_URI, process.env.DST_DB_NAME || name)]);
  const names = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  let ok = true;
  for (const n of names) {
    const x = a[n], y = b[n];
    const problems = [];
    if (!x) problems.push("fehlt in Quelle");
    else if (!y) problems.push("fehlt im Ziel");
    else {
      if (x.count !== y.count) problems.push(`Anzahl ${x.count} ≠ ${y.count}`);
      if (x.sha256 !== y.sha256) problems.push("Dokumente unterschiedlich");
      if (JSON.stringify(x.indexes) !== JSON.stringify(y.indexes)) problems.push(`Indizes unterschiedlich: ${JSON.stringify(x.indexes)} vs ${JSON.stringify(y.indexes)}`);
      if (x.options !== y.options) problems.push(`Optionen ${x.options} ≠ ${y.options}`);
    }
    if (problems.length) ok = false;
    console.log(`${problems.length ? "✗" : "✓"} ${n.padEnd(20)} ${String(x?.count ?? "-").padStart(4)} Dok. · ${x?.indexes.length ?? "-"} Indizes · ${x?.sha256.slice(0, 12) ?? ""} ${problems.join("; ")}`);
  }
  console.log(ok ? "ERGEBNIS: identisch" : "ERGEBNIS: ABWEICHUNG");
  process.exit(ok ? 0 : 2);
})().catch((e) => {
  console.error("Fehler:", e.message.replace(/mongodb(\+srv)?:\/\/[^@\s]+@/g, "mongodb$1://***@"));
  process.exit(1);
});
