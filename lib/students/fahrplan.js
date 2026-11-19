// Themenfahrplan eines Kindes: eine chronologische Liste von Themen (z. B. aus
// dem Aufnahmegespräch), die mit dem Nachhilfetagebuch zusammengeführt wird.
//
// Speicherort: student.fahrplan = { start, themen: [{ id, titel, notiz, sitztAm }] }
//   start    – ab diesem Tag (ISO-Datum) zählen Tagebucheinträge; ältere Stunden
//              bleiben außen vor („erst ab jetzt“).
//   themen   – Reihenfolge = geplante Reihenfolge.
//   sitztAm  – von Hand als „sitzt“ markiert (ISO-Datum), sonst null.
//
// Verknüpfung: Im Tagebuch einer Stunde steht diary.fahrplan = [{ id, sitzt }]
// – welche Themen in der Stunde dran waren und ob eins damit abgeschlossen ist.
// Wie es gelaufen ist, steht im Tagebuch selbst (Was wurde gemacht?, Verständnis,
// Mitarbeit, Offene Fragen); der Fahrplan zeigt diese Einträge je Thema an. So
// wird das Tagebuch zum Themenfahrplan, ohne dass etwas doppelt gepflegt wird.
//
// Diese Datei ist rein (kein DB-Zugriff) und läuft im Server und im Browser.

export const FAHRPLAN_GRENZEN = { themen: 60, titel: 90, notiz: 300 };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[A-Za-z0-9_-]{6,64}$/;

function zeile(wert, max) {
  return String(wert ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max + 1);
}

function text(wert, max) {
  return String(wert ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max + 1);
}

/**
 * Eingabe aus dem Admin (ganzer Fahrplan auf einmal). Unbekannte/fehlende IDs
 * bekommen eine neue – vorhandene bleiben erhalten, damit die Verknüpfungen im
 * Tagebuch weiter stimmen.
 * @param {object} body  { start, themen: [{ id?, titel, notiz?, sitztAm? }] }
 * @param {() => string} neueId
 */
export function normalizeFahrplanInput(body, neueId) {
  const problems = [];
  const start = String(body?.start ?? "").trim();
  if (!ISO.test(start)) problems.push("Bitte ein gültiges Startdatum wählen.");
  const roh = Array.isArray(body?.themen) ? body.themen : [];
  if (roh.length > FAHRPLAN_GRENZEN.themen) problems.push(`Höchstens ${FAHRPLAN_GRENZEN.themen} Themen.`);
  const gesehen = new Set();
  const themen = [];
  roh.slice(0, FAHRPLAN_GRENZEN.themen).forEach((t, i) => {
    const titel = zeile(t?.titel, FAHRPLAN_GRENZEN.titel);
    const notiz = text(t?.notiz, FAHRPLAN_GRENZEN.notiz);
    if (!titel) {
      problems.push(`Thema ${i + 1}: Bitte einen Titel eintragen.`);
      return;
    }
    if (titel.length > FAHRPLAN_GRENZEN.titel) problems.push(`„${titel.slice(0, 30)}…“: höchstens ${FAHRPLAN_GRENZEN.titel} Zeichen.`);
    if (notiz.length > FAHRPLAN_GRENZEN.notiz) problems.push(`„${titel.slice(0, 30)}“: Notiz höchstens ${FAHRPLAN_GRENZEN.notiz} Zeichen.`);
    let id = typeof t?.id === "string" && ID.test(t.id) && !gesehen.has(t.id) ? t.id : neueId();
    gesehen.add(id);
    const sitztAm = typeof t?.sitztAm === "string" && ISO.test(t.sitztAm) ? t.sitztAm : null;
    themen.push({ id, titel: titel.slice(0, FAHRPLAN_GRENZEN.titel), notiz: notiz.slice(0, FAHRPLAN_GRENZEN.notiz), sitztAm });
  });
  return { fahrplan: { start, themen }, problems };
}

/** Verknüpfungen aus dem Tagebuch-Dialog: nur bekannte Form, höchstens 10. */
export function normalizeFahrplanLinks(value) {
  if (!Array.isArray(value)) return [];
  const gesehen = new Set();
  const links = [];
  for (const v of value) {
    const id = typeof v?.id === "string" && ID.test(v.id) ? v.id : null;
    if (!id || gesehen.has(id)) continue;
    gesehen.add(id);
    links.push({ id, sitzt: v.sitzt === true });
    if (links.length === 10) break;
  }
  return links;
}

/** Zählt die Stunde für den Fahrplan? Kennenlern-Meeting, Absagen und Ablehnungen nicht. */
function zaehlt(stunde, start) {
  if (!stunde || stunde.kennenlernen) return false;
  if (["cancelled", "rejected"].includes(stunde.status)) return false;
  if (stunde.heldStatus === "missed") return false;
  return String(stunde.requestedDate || "") >= start;
}

function hatTagebuch(stunde) {
  const d = stunde.diary || {};
  return Boolean(
    String(stunde.lessonNotes || "").trim() ||
      ["topic", "homework", "material", "openQuestions", "nextExam"].some((k) => String(d[k] || "").trim()) ||
      d.understanding ||
      d.participation ||
      (d.fahrplan || []).length
  );
}

function eintrag(stunde, link) {
  const d = stunde.diary || {};
  return {
    stundeId: stunde._id,
    datum: stunde.requestedDate,
    zeit: stunde.requestedTime || "",
    thema: d.topic || "",
    gemacht: String(stunde.lessonNotes || "").trim(),
    offeneFragen: d.openQuestions || "",
    hausaufgabe: d.homework || "",
    verstaendnis: d.understanding || null,
    mitarbeit: d.participation || null,
    sitzt: Boolean(link?.sitzt),
  };
}

const chronologisch = (a, b) => `${a.datum} ${a.zeit}`.localeCompare(`${b.datum} ${b.zeit}`);

/**
 * Fahrplan + Tagebuch zusammengeführt.
 * @returns {null | {
 *   start: string,
 *   themen: Array<{ id, titel, notiz, sitztAm, status: "offen"|"laeuft"|"sitzt", eintraege: object[], aktuell: boolean }>,
 *   ohneThema: object[],    // Tagebucheinträge seit Start ohne Fahrplan-Thema (gehen nicht verloren)
 *   fortschritt: { sitzt: number, laeuft: number, offen: number, gesamt: number },
 * }}
 */
export function fahrplanUebersicht(fahrplan, stunden = []) {
  if (!fahrplan || !Array.isArray(fahrplan.themen)) return null;
  const start = fahrplan.start || "0000-00-00";
  const ids = new Set(fahrplan.themen.map((t) => t.id));
  const proThema = new Map(fahrplan.themen.map((t) => [t.id, []]));
  const ohneThema = [];

  for (const s of stunden) {
    if (!zaehlt(s, start) || !hatTagebuch(s)) continue;
    const links = (s.diary?.fahrplan || []).filter((l) => ids.has(l.id));
    if (links.length === 0) {
      ohneThema.push(eintrag(s, null));
      continue;
    }
    for (const l of links) proThema.get(l.id).push(eintrag(s, l));
  }

  let aktuellGesetzt = false;
  const themen = fahrplan.themen.map((t) => {
    const eintraege = proThema.get(t.id).sort(chronologisch);
    const status = t.sitztAm || eintraege.some((e) => e.sitzt) ? "sitzt" : eintraege.length ? "laeuft" : "offen";
    const aktuell = !aktuellGesetzt && status !== "sitzt";
    if (aktuell) aktuellGesetzt = true;
    return { ...t, status, eintraege, aktuell };
  });
  const zaehle = (st) => themen.filter((t) => t.status === st).length;
  return {
    start,
    themen,
    ohneThema: ohneThema.sort(chronologisch),
    fortschritt: { sitzt: zaehle("sitzt"), laeuft: zaehle("laeuft"), offen: zaehle("offen"), gesamt: themen.length },
  };
}

/**
 * Vorschlag für den Tagebuch-Dialog: Welche Themen sind für diese Stunde
 * sinnvoll anzubieten? Alle noch nicht abgeschlossenen + die schon verknüpften,
 * das aktuelle zuerst markiert. Passt der Text „Thema der Stunde“ zu einem
 * Titel, wird das Thema vorgeschlagen.
 */
export function themenFuerStunde(fahrplan, stunden, stunde) {
  const uebersicht = fahrplanUebersicht(fahrplan, stunden);
  if (!uebersicht || !stunde || String(stunde.requestedDate || "") < uebersicht.start) return null;
  const verknuepft = new Map((stunde.diary?.fahrplan || []).map((l) => [l.id, l]));
  const thema = String(stunde.diary?.topic || "").toLowerCase();
  return uebersicht.themen
    .filter((t) => t.status !== "sitzt" || verknuepft.has(t.id) || t.eintraege.some((e) => e.stundeId === stunde._id))
    .map((t) => ({
      id: t.id,
      titel: t.titel,
      status: t.status,
      aktuell: t.aktuell,
      gewaehlt: verknuepft.has(t.id),
      sitzt: Boolean(verknuepft.get(t.id)?.sitzt),
      passtZumThema: Boolean(thema) && (thema.includes(t.titel.toLowerCase()) || t.titel.toLowerCase().includes(thema)),
    }));
}
