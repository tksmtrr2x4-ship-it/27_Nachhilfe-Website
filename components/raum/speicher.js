"use client";

// Die Tafel bleibt auf dem Gerät: Damit ein Neuladen oder ein kurzer
// Netzaussetzer nichts löscht, liegt sie im Browser (IndexedDB) – nie auf dem
// Server. „Tafel leeren“ entfernt sie; nach 30 Tagen räumt sich der Speicher
// beim nächsten Öffnen selbst auf.

const DB = "lernsprung-tafel";
const STORE = "tafeln";
const TAGE = 30;

function oeffnen() {
  return new Promise((ok, fehler) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fehler(req.error);
  });
}

async function mitStore(modus, arbeit) {
  const db = await oeffnen();
  return new Promise((ok, fehler) => {
    const tx = db.transaction(STORE, modus);
    const ergebnis = arbeit(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      ok(ergebnis?.result);
    };
    tx.onerror = () => {
      db.close();
      fehler(tx.error);
    };
  });
}

export async function tafelLaden(schluessel) {
  try {
    const wert = await mitStore("readonly", (s) => s.get(schluessel));
    if (!wert) return null;
    if (Date.now() - (wert.gespeichertAm || 0) > TAGE * 864e5) {
      await tafelLoeschen(schluessel);
      return null;
    }
    return wert;
  } catch {
    return null;
  }
}

export async function tafelSpeichern(schluessel, stand) {
  try {
    await mitStore("readwrite", (s) => s.put({ ...stand, gespeichertAm: Date.now() }, schluessel));
  } catch {
    // Ohne Speicher (privates Fenster) geht es auch – dann eben ohne Sicherung.
  }
}

export async function tafelLoeschen(schluessel) {
  try {
    await mitStore("readwrite", (s) => s.delete(schluessel));
  } catch {
    // egal
  }
}
