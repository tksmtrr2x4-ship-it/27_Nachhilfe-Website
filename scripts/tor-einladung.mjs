// Notausgang: Einen Einladungslink für die Tür erzeugen, ohne in der
// Verwaltung zu sein. Nötig, wenn kein Gerät mehr hindurchkommt und der
// dauerhafte Code abgeschaltet ist.
// Aufruf auf dem Server:  npm run tor:einladung
import crypto from "node:crypto";
import fs from "node:fs";
import { MongoClient } from "mongodb";

const envFile = process.env.LERNSPRUNG_ENV || "/etc/lernsprung/.env.production";
if (!process.env.MONGODB_URI && fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && !line.startsWith("#")) process.env[line.slice(0, i).trim()] ||= line.slice(i + 1).trim();
  }
}

const MINUTEN = 5;
const code = Array.from({ length: 16 }, () => crypto.randomInt(0, 10)).join("");
const client = await MongoClient.connect(process.env.MONGODB_URI);
const col = client.db(process.env.MONGODB_DB).collection("admin_gate_invites");
await col.createIndex({ verfaelltAm: 1 }, { expireAfterSeconds: 0 });
await col.insertOne({
  _id: crypto.randomUUID(),
  codeHash: crypto.createHash("sha256").update(code, "utf8").digest("hex"),
  label: "Vom Server erzeugt",
  erstelltAm: new Date().toISOString(),
  verfaelltAm: new Date(Date.now() + MINUTEN * 60 * 1000),
  benutztAm: null,
  benutztVon: null,
});
await client.close();

const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.lernsprung-vs.de").replace(/\/$/, "");
console.log(`${origin}/tor/${code}`);
console.log(`Gilt ${MINUTEN} Minuten und genau einmal.`);
