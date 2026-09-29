import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

// Prüfungen zum Kundenkonto ohne Datenbank: Die Module werden mit einer
// Attrappe im Arbeitsspeicher geladen (siehe ladeMitDb weiter unten).

test("Eingaben werden gekappt, bevor sie irgendwo landen", async () => {
  const { modul } = await ladeMitDb("../lib/kunden/konto.js");
  assert.equal(modul.kurz("  Hallo  ", 100), "Hallo");
  assert.equal(modul.kurz("x".repeat(500), 40).length, 40);
  assert.equal(modul.kurz(null, 10), "");
  assert.equal(modul.kurz(undefined, 10), "");
});

test("Konto-Keks: HttpOnly und SameSite, Secure nur außerhalb der Entwicklung", async () => {
  const { modul } = await ladeMitDb("../lib/kunden/konto.js");
  const merken = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "development";
    const lokal = modul.kontoCookie("abc");
    assert.match(lokal, /^lernsprung_konto=abc;/);
    assert.match(lokal, /HttpOnly/);
    assert.match(lokal, /SameSite=Lax/);
    assert.ok(!/Secure/.test(lokal), "auf http://localhost käme ein Secure-Keks nie zurück");

    process.env.NODE_ENV = "production";
    assert.match(modul.kontoCookie("abc"), /Secure/);
    assert.match(modul.kontoCookieGeloescht(), /Max-Age=0/);
  } finally {
    process.env.NODE_ENV = merken;
  }
});

test("Anmeldelink gilt genau einmal", async () => {
  const { modul, db } = await ladeMitDb("../lib/kunden/konto.js");

  const code = await modul.createLoginLink("kunde-1");
  assert.ok(code.length > 20);
  // In der Datenbank steht kein Code im Klartext.
  assert.ok(!JSON.stringify([...db.docs.values()]).includes(code));

  assert.equal(await modul.claimLink("falscher-code"), null);
  assert.deepEqual(await modul.claimLink(code), { art: "anmeldung", customerId: "kunde-1", daten: undefined });
  assert.equal(await modul.claimLink(code), null, "ein zweites Mal geht nicht");
});

test("Registrierung legt erst mit der Bestätigung Daten an", async () => {
  const { modul, db } = await ladeMitDb("../lib/kunden/konto.js");
  const daten = { elternName: "A. Beispiel", email: "a@example.de", schuelerName: "Kind" };
  const code = await modul.createRegistrationLink(daten);

  // Bis zur Bestätigung existiert nur der kurzlebige Eintrag – keine Akte.
  const eintraege = [...db.docs.values()];
  assert.equal(eintraege.length, 1);
  assert.equal(eintraege[0].art, "registrierung");

  const eingeloest = await modul.claimLink(code);
  assert.equal(eingeloest.art, "registrierung");
  assert.deepEqual(eingeloest.daten, daten);
});

test("Abgelaufene Links öffnen nichts", async () => {
  const { modul, db } = await ladeMitDb("../lib/kunden/konto.js");
  const code = await modul.createLoginLink("kunde-1");
  for (const doc of db.docs.values()) doc.verfaelltAm = new Date(Date.now() - 1000);
  assert.equal(await modul.claimLink(code), null);
});

test("Sitzung: gültig, widerrufbar, läuft ab", async () => {
  const { modul, db } = await ladeMitDb("../lib/kunden/konto.js");

  const token = await modul.createKontoSession("kunde-1", { userAgent: "Safari" });
  assert.ok(!JSON.stringify([...db.docs.values()]).includes(token), "gespeichert wird nur der Hash");
  assert.equal(await modul.sessionCustomerId(token), "kunde-1");
  assert.equal(await modul.sessionCustomerId("erfunden"), null);

  await modul.endKontoSession(token);
  assert.equal(await modul.sessionCustomerId(token), null);

  const zweiter = await modul.createKontoSession("kunde-1");
  for (const doc of db.docs.values()) doc.verfaelltAm = new Date(Date.now() - 1000);
  assert.equal(await modul.sessionCustomerId(zweiter), null, "abgelaufen zählt wie nicht vorhanden");
});

test("Mailbremse: je Adresse und insgesamt", async () => {
  const { modul } = await ladeMitDb("../lib/kunden/konto.js");

  for (let i = 0; i < 3; i += 1) {
    assert.equal(await modul.darfMailSenden("a@example.de"), true, `Versuch ${i + 1} soll durchgehen`);
  }
  assert.equal(await modul.darfMailSenden("a@example.de"), false, "die vierte Mail an dieselbe Adresse nicht mehr");
  assert.equal(await modul.darfMailSenden("b@example.de"), true, "eine andere Adresse ist davon unberührt");

  // Und insgesamt ist bei 20 Schluss, egal über wie viele Adressen.
  const { modul: zweites } = await ladeMitDb("../lib/kunden/konto.js");
  let durch = 0;
  for (let i = 0; i < 40; i += 1) {
    if (await zweites.darfMailSenden(`nr${i}@example.de`)) durch += 1;
  }
  assert.equal(durch, 20);
});

test("Die Kundenansicht zeigt keine internen Notizen", async () => {
  const db = fakeDb();
  db.docs.set("s1", {
    _id: "s1",
    customerId: "k1",
    name: "Kind",
    studentClass: "7",
    subjects: [],
    status: "active",
    // Genau das darf nicht hinausgehen:
    notes: "INTERN: tut sich schwer mit Brüchen",
    noteLog: [{ _id: "n1", text: "INTERN: Elterngespräch" }],
    __col: "students",
  });
  db.docs.set("b1", {
    _id: "b1",
    studentId: "s1",
    status: "confirmed",
    offerSnapshot: { type: "session", durationMinutes: 60 },
    requestedDate: "2099-01-02",
    requestedTime: "16:00",
    subject: "Mathe",
    locationType: "online",
    meetingToken: "tok123",
    lessonNotes: "INTERN: Hausaufgaben vergessen",
    diary: [{ text: "INTERN: Tagebuch" }],
    __col: "bookings",
  });

  const quelle = fs
    .readFileSync(new URL("../lib/kunden/uebersicht.js", import.meta.url), "utf8")
    .replace('import { getDb } from "@/lib/mongo";', "const getDb = async () => globalThis.__kontoTestDb;")
    .replace('import { todayIsoBerlin } from "@/lib/adminError";', 'const todayIsoBerlin = () => "2026-01-01";')
    .replace(
      'import { getCustomer } from "@/lib/invoicing/db";',
      'const getCustomer = async () => ({ _id: "k1", name: "A. Beispiel", email: "a@example.de" });'
    )
    .replace(
      'import { listNachrichten, markiereGelesen } from "@/lib/kunden/nachrichten";',
      "const listNachrichten = async () => []; const markiereGelesen = async () => 0;"
    );
  globalThis.__kontoTestDb = db;
  const { kontoUebersicht } = await import(
    `data:text/javascript;base64,${Buffer.from(quelle, "utf8").toString("base64")}`
  );

  const sicht = await kontoUebersicht("k1");
  const alsText = JSON.stringify(sicht);
  assert.ok(!alsText.includes("INTERN"), "weder Notizen noch Tagebuch dürfen in der Kundenansicht stehen");
  assert.equal(sicht.naechste.fach, "Mathe");
  assert.equal(sicht.naechste.onlineLink, "/meeting/tok123", "der Meeting-Link ist erwünscht");
  assert.equal(sicht.schueler[0].name, "Kind");
  assert.equal(sicht.kunde.email, "a@example.de");
});

// --- Hilfsmittel ---

async function ladeMitDb(relativerPfad) {
  const db = fakeDb();
  const schluessel = `__kontoDb_${crypto.randomUUID()}`;
  const quelle = fs
    .readFileSync(new URL(relativerPfad, import.meta.url), "utf8")
    .replace('import { getDb } from "@/lib/mongo";', `const getDb = async () => globalThis[${JSON.stringify(schluessel)}];`);
  globalThis[schluessel] = db;
  const modul = await import(`data:text/javascript;base64,${Buffer.from(quelle, "utf8").toString("base64")}`);
  return { modul, db };
}

// Gerade so viel MongoDB, wie die Module brauchen. Dokumente merken sich in
// __col, zu welcher Sammlung sie gehören – so reicht eine Ablage für alle.
function fakeDb() {
  const docs = new Map();
  // Auch Pfade mit Punkt ("offerSnapshot.type"), wie MongoDB sie versteht.
  const wertVon = (doc, pfad) => pfad.split(".").reduce((o, teil) => (o == null ? undefined : o[teil]), doc);
  const passt = (doc, query) =>
    Object.entries(query).every(([feld, wunsch]) => {
      const wert = wertVon(doc, feld);
      if (wunsch && typeof wunsch === "object" && !Array.isArray(wunsch)) {
        if ("$gt" in wunsch) return new Date(wert) > new Date(wunsch.$gt);
        if ("$gte" in wunsch) return String(wert) >= String(wunsch.$gte);
        if ("$in" in wunsch) return wunsch.$in.includes(wert);
      }
      return wert === wunsch;
    });

  function collection(name) {
    const eigene = () => [...docs.values()].filter((d) => (d.__col || name) === name);
    return {
      async createIndex() {},
      async insertOne(doc) {
        docs.set(doc._id, { ...doc, __col: name });
        return { insertedId: doc._id };
      },
      async findOne(query) {
        const treffer = eigene().find((d) => passt(d, query));
        return treffer ? { ...treffer } : null;
      },
      async findOneAndDelete(query) {
        const treffer = eigene().find((d) => passt(d, query));
        if (!treffer) return null;
        docs.delete(treffer._id);
        return { ...treffer };
      },
      async countDocuments(query) {
        return eigene().filter((d) => passt(d, query)).length;
      },
      async deleteOne(query) {
        const treffer = eigene().find((d) => passt(d, query));
        if (treffer) docs.delete(treffer._id);
        return { deletedCount: treffer ? 1 : 0 };
      },
      async deleteMany(query) {
        const treffer = eigene().filter((d) => passt(d, query));
        for (const d of treffer) docs.delete(d._id);
        return { deletedCount: treffer.length };
      },
      async updateMany() {
        return { modifiedCount: 0 };
      },
      find(query = {}) {
        let treffer = eigene().filter((d) => passt(d, query));
        return {
          project(felder) {
            const keys = Object.keys(felder);
            treffer = treffer.map((d) => Object.fromEntries([["_id", d._id], ...keys.map((k) => [k, d[k]])]));
            return this;
          },
          sort() {
            return this;
          },
          limit(n) {
            treffer = treffer.slice(0, n);
            return this;
          },
          async toArray() {
            return treffer.map((d) => {
              const kopie = { ...d };
              delete kopie.__col;
              return kopie;
            });
          },
        };
      },
    };
  }
  return { collection, docs };
}

// --- Selbstauskunft: dieselben Angaben wie auf dem Aufnahmebogen ---

const { pruefeSelbstauskunft, kundeAusSelbstauskunft, schuelerAusSelbstauskunft, vorbelegungAus } = await import(
  "@/lib/kunden/selbstauskunft"
);

function vollstaendig(aenderung = {}) {
  return {
    eltern: {
      anrede: "Frau",
      name: "Alex Beispiel",
      beziehung: "Mutter",
      email: "Alex@Example.DE",
      telefon: "07721 123456",
      strasse: "Musterweg 1",
      plz: "78048",
      ort: "Villingen-Schwenningen",
    },
    schueler: { name: "Mira Beispiel", klasse: "9", schulart: "gymnasium", schule: "Gymnasium am Hoptbühl" },
    bedarf: [{ fach: "Mathematik", note: "4", ziel: "auf eine 3 kommen" }],
    organisation: { ort: "online", haeufigkeit: "wöchentlich", dauer: "60 Minuten" },
    sonstiges: { aufmerksamDurch: "Empfehlung" },
    ...aenderung,
  };
}

test("Selbstauskunft: Pflichtangaben und Formate", () => {
  const { probleme } = pruefeSelbstauskunft(vollstaendig());
  assert.deepEqual(probleme, [], "vollständige Angaben laufen durch");

  assert.match(pruefeSelbstauskunft({}).probleme.join(" "), /Namen angeben/);
  assert.match(
    pruefeSelbstauskunft(vollstaendig({ eltern: { ...vollstaendig().eltern, email: "keine-adresse" } })).probleme.join(" "),
    /gültige E-Mail/
  );
  assert.match(
    pruefeSelbstauskunft(vollstaendig({ eltern: { ...vollstaendig().eltern, plz: "780" } })).probleme.join(" "),
    /Postleitzahl/
  );
  assert.match(
    pruefeSelbstauskunft(vollstaendig({ schueler: { name: "Mira", klasse: "14" } })).probleme.join(" "),
    /Klasse muss zwischen 1 und 13/
  );
});

test("Selbstauskunft: Fächer gegen dieselben Regeln wie die Buchung", () => {
  // Wirtschaft gibt es erst in der Oberstufe – in der Akte soll nichts
  // stehen, was so gar nicht buchbar wäre.
  const zuFrueh = pruefeSelbstauskunft(
    vollstaendig({ schueler: { name: "Mira", klasse: "9" }, bedarf: [{ fach: "Wirtschaft" }] })
  );
  assert.match(zuFrueh.probleme.join(" "), /Wirtschaft ist erst ab Klasse 11/);

  // Physik kennt in der Oberstufe nur das Basisfach.
  const falschesNiveau = pruefeSelbstauskunft(
    vollstaendig({ schueler: { name: "Mira", klasse: "12" }, bedarf: [{ fach: "Physik", niveau: "leistung" }] })
  );
  assert.equal(falschesNiveau.probleme.length, 1);

  // Erfundene Werte fallen still weg, statt gespeichert zu werden.
  const erfunden = pruefeSelbstauskunft(
    vollstaendig({ bedarf: [{ fach: "Zauberei" }], schueler: { name: "Mira", klasse: "9", schulart: "hogwarts" } })
  );
  assert.deepEqual(erfunden.daten.bedarf, []);
  assert.equal(erfunden.daten.schueler.schulart, "");
});

test("Selbstauskunft: Unterricht zu Hause braucht eine Anschrift", () => {
  const ohne = pruefeSelbstauskunft(
    vollstaendig({
      eltern: { ...vollstaendig().eltern, strasse: "", plz: "", ort: "" },
      organisation: { ort: "student" },
    })
  );
  assert.match(ohne.probleme.join(" "), /Anschrift/);

  const mit = pruefeSelbstauskunft(vollstaendig({ organisation: { ort: "student" } }));
  assert.deepEqual(mit.probleme, [], "die Rechnungsanschrift genügt");
});

test("Selbstauskunft wird zu Kunde und Schülerakte", () => {
  const { daten } = pruefeSelbstauskunft(vollstaendig());

  const kunde = kundeAusSelbstauskunft(daten);
  assert.equal(kunde.email, "alex@example.de", "Adresse wird kleingeschrieben gespeichert");
  assert.equal(kunde.street, "Musterweg 1");
  assert.equal(kunde.zip, "78048");

  const akte = schuelerAusSelbstauskunft(daten, "kunde-1");
  assert.equal(akte.customerId, "kunde-1");
  assert.equal(akte.studentClass, "9");
  assert.equal(akte.schoolType, "gymnasium");
  assert.deepEqual(akte.subjects, [{ subject: "Mathematik", courseLevel: "" }]);
  assert.equal(akte.defaultLocationType, "online");
  assert.equal(akte.geprueft, false, "eine selbst angelegte Akte ist zunächst ungeprüft");
  assert.equal(akte.selbstAngelegt, true);
  // Was kein eigenes Feld hat, geht trotzdem nicht verloren.
  assert.equal(akte.selbstauskunft.bedarf[0].ziel, "auf eine 3 kommen");
  assert.equal(akte.selbstauskunft.eltern.erreichbarkeit, "");
});

test("Vorbelegung der Buchung aus Konto und Akte", () => {
  const belegung = vorbelegungAus({
    kunde: { name: "Alex Beispiel", email: "a@example.de", phone: "07721 1", street: "Musterweg 1", zip: "78048", city: "VS" },
    schueler: {
      name: "Mira",
      studentClass: "9",
      subjects: [{ subject: "Mathematik", courseLevel: "" }],
      defaultLocationType: "student",
      locationAddress: "",
    },
  });
  assert.equal(belegung.parentName, "Alex Beispiel");
  assert.equal(belegung.studentName, "Mira");
  assert.equal(belegung.locationType, "student");
  assert.equal(belegung.locationAddress, "Musterweg 1, 78048 VS", "ohne eigene Unterrichtsadresse gilt die Rechnungsanschrift");
  assert.deepEqual(belegung.faecher, [{ subject: "Mathematik", courseLevel: "" }]);
});
