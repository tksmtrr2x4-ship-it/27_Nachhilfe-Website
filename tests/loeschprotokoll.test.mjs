import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

// Gelöscht heißt endgültig: Das Protokoll darf keine Kopie des Datensatzes
// aufbewahren – nur den Vermerk.

async function ladeMitDb() {
  const docs = [];
  const col = {
    async createIndex() {},
    async insertOne(d) {
      docs.push({ ...d });
    },
    async deleteOne(q) {
      const i = docs.findIndex((d) => d._id === q._id);
      if (i >= 0) docs.splice(i, 1);
      return { deletedCount: i >= 0 ? 1 : 0 };
    },
    async deleteMany() {
      const n = docs.length;
      docs.length = 0;
      return { deletedCount: n };
    },
  };
  const schluessel = `__loeschDb_${crypto.randomUUID()}`;
  globalThis[schluessel] = { collection: () => col };
  const quelle = fs
    .readFileSync(new URL("../lib/admin/loeschprotokoll.js", import.meta.url), "utf8")
    .replace('import { getDb } from "@/lib/mongo";', `const getDb = async () => globalThis[${JSON.stringify(schluessel)}];`);
  const modul = await import(`data:text/javascript;base64,${Buffer.from(quelle, "utf8").toString("base64")}`);
  return { modul, docs };
}

test("Protokoll hält nur den Vermerk fest, keine Kopie des Datensatzes", async () => {
  const { modul, docs } = await ladeMitDb();
  await modul.protokolliereLoeschung({
    art: "buchung",
    id: "b1",
    grund: "doppelt",
    hinweise: ["rechnung"],
    daten: { studentName: "Lena Muster", parentEmail: "eva@example.org" },
  });
  assert.equal(docs.length, 1);
  assert.equal(docs[0].art, "buchung");
  assert.equal(docs[0].grund, "doppelt");
  assert.equal(docs[0].daten, undefined);
  assert.ok(!JSON.stringify(docs[0]).includes("Lena"), "kein Name im Protokoll");
  assert.ok(!JSON.stringify(docs[0]).includes("example.org"), "keine Adresse im Protokoll");
});

test("Grund ist freiwillig", async () => {
  const { modul, docs } = await ladeMitDb();
  await modul.protokolliereLoeschung({ art: "buchung", id: "b2" });
  assert.equal(docs[0].grund, "");
});

test("Einträge lassen sich einzeln und gesammelt endgültig entfernen", async () => {
  const { modul, docs } = await ladeMitDb();
  await modul.protokolliereLoeschung({ art: "buchung", id: "b1" });
  await modul.protokolliereLoeschung({ art: "buchung", id: "b2" });
  assert.equal(await modul.entferneLoeschung(docs[0]._id), true);
  assert.equal(await modul.entferneLoeschung("gibt-es-nicht"), false);
  assert.equal(await modul.leereLoeschprotokoll(), 1);
  assert.equal(docs.length, 0);
});
