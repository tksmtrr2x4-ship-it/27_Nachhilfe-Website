// Notausgang: Alle Passkeys, bekannten Geräte und Sitzungen löschen. Danach
// genügt zur Anmeldung wieder der PIN allein (siehe lib/auth.js), und ein
// neuer Passkey lässt sich einrichten. Die Tür bleibt unberührt – kommt kein
// Gerät mehr hindurch, hilft `npm run tor:einladung`.
// Aufruf auf dem Server:  npm run zugang:zuruecksetzen
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
for (const name of [
  "admin_passkeys",
  "admin_devices",
  "admin_sessions",
  "admin_webauthn_challenges",
  "admin_login_requests",
]) {
  const res = await db.collection(name).deleteMany({});
  console.log(`${name}: ${res.deletedCount} Einträge entfernt`);
}
console.log("Anmeldung läuft jetzt wieder allein über den PIN.");
await client.close();
