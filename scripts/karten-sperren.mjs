// Notausgang: Alle NFC-Karten sperren und alle Sitzungen beenden. Danach
// genügt zur Anmeldung wieder der PIN allein (siehe lib/auth.js).
// Aufruf auf dem Server:  npm run karten:sperren
import { MongoClient } from "mongodb";
import fs from "fs";

const envFile = process.env.LERNSPRUNG_ENV || "/etc/lernsprung/.env.production";
if (!process.env.MONGODB_URI && fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && !line.startsWith("#")) process.env[line.slice(0, i).trim()] ||= line.slice(i + 1).trim();
  }
}

const client = await MongoClient.connect(process.env.MONGODB_URI);
const db = client.db(process.env.MONGODB_DB);
const cards = await db.collection("admin_cards").updateMany({ revokedAt: null }, { $set: { revokedAt: new Date().toISOString() } });
const sessions = await db.collection("admin_sessions").deleteMany({});
console.log(`${cards.modifiedCount} Karte(n) gesperrt, ${sessions.deletedCount} Sitzung(en) beendet.`);
console.log("Anmeldung läuft jetzt wieder allein über den PIN.");
await client.close();
