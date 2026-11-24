// Themenfahrplan eines Kindes: eine chronologische Liste von Themen (z. B. aus
// dem Aufnahmegespräch), die mit dem Nachhilfetagebuch zusammengeführt wird.
//
// Fahrpläne sind fachspezifisch – je Fach des Kindes höchstens einer:
// Speicherort: student.fahrplaene = [{ fach, start, themen: [{ id, titel, notiz, sitztAm }] }]
//   fach     – Fachname wie in student.subjects[].subject (z. B. „Mathematik“);
//              zugeordnet werden nur Stunden dieses Fachs (lesson.subjectName).
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
// Früher gab es nur einen Fahrplan ohne Fach (student.fahrplan). fahrplaeneVon()
// liest ihn weiter – als Fahrplan des ersten Fachs – bis er beim nächsten
// Speichern in student.fahrplaene übernommen wird.
//
// Diese Datei ist rein (kein DB-Zugriff) und läuft im Server und im Browser.

export const FAHRPLAN_GRENZEN = { themen: 60, titel: 90, notiz: 300 };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Fach einer Stunde ohne Kursniveau („Biologie (Basisfach)“ → „Biologie“). */
export function fachVonStunde(stunde) {
  return String(stunde?.subjectName || stunde?.subject || "")
    .replace(/\s*\(.*\)$/, "")
    .trim();
}

/** Alle Fahrpläne eines Kindes, in der Reihenfolge seiner Fächer. */
export function fahrplaeneVon(student) {
  const liste = Array.isArray(student?.fahrplaene) ? student.fahrplaene.filter((f) => f?.fach && Array.isArray(f.themen)) : [];
  const alt = student?.fahrplan;
  if (alt && Array.isArray(alt.themen)) {
    const fach = alt.fach || student?.subjects?.[0]?.subject || "";
    if (fach && !liste.some((f) => f.fach === fach)) liste.push({ ...alt, fach });
  }
  const reihenfolge = (student?.subjects || []).map((s) => s.subject);
  const rang = (fach) => (reihenfolge.includes(fach) ? reihenfolge.indexOf(fach) : reihenfolge.length);
  return liste.sort((a, b) => rang(a.fach) - rang(b.fach));
}

/** Fächer für das Auswahlmenü: Fächer des Kindes, dazu Fächer mit Fahrplan, die nicht mehr eingetragen sind. */
export function fahrplanFaecher(student) {
  const faecher = (student?.subjects || []).map((s) => s.subject).filter(Boolean);
  for (const f of fahrplaeneVon(student)) if (!faecher.includes(f.fach)) faecher.push(f.fach);
  return faecher;
}

/** Der Fahrplan, zu dem eine Stunde gehört (gleiches Fach), sonst null. */
export function fahrplanFuerStunde(fahrplaene, stunde) {
  const liste = Array.isArray(fahrplaene) ? fahrplaene : [];
  const fach = fachVonStunde(stunde);
  if (!fach) return liste.length === 1 ? liste[0] : null;
  return liste.find((f) => f.fach === fach) || null;
}
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
 * Eingabe aus dem Admin (ganzer Fahrplan eines Fachs auf einmal). Unbekannte/
 * fehlende IDs bekommen eine neue – vorhandene bleiben erhalten, damit die
 * Verknüpfungen im Tagebuch weiter stimmen.
 * @param {object} body  { fach, start, themen: [{ id?, titel, notiz?, sitztAm? }] }
 * @param {() => string} neueId
 * @param {string[]} [faecher]  erlaubte Fächer (fahrplanFaecher); ohne Angabe jedes
 */
export function normalizeFahrplanInput(body, neueId, faecher) {
  const problems = [];
  const fach = zeile(body?.fach, 40);
  if (!fach) problems.push("Bitte ein Fach wählen.");
  else if (Array.isArray(faecher) && !faecher.includes(fach)) problems.push(`${fach} ist kein Fach dieses Kindes.`);
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
  return { fahrplan: { fach, start, themen }, problems };
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

/** Zählt die Stunde für den Fahrplan? Andere Fächer, Kennenlern-Meeting, Absagen und Ablehnungen nicht. */
function zaehlt(stunde, start, fach) {
  if (!stunde || stunde.kennenlernen) return false;
  if (fach && fachVonStunde(stunde) && fachVonStunde(stunde) !== fach) return false;
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
 *   fach: string,
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
    if (!zaehlt(s, start, fahrplan.fach) || !hatTagebuch(s)) continue;
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
    fach: fahrplan.fach || "",
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

/**
 * Für das gedruckte Tagebuchblatt: welche Fahrplan-Themen in dieser Stunde dran
 * waren und der Stand des Fahrplans nach dieser Stunde (nur Stunden bis zu ihrem
 * Datum, von Hand gesetztes „sitzt“ nur bis dahin). null ohne Fahrplan oder vor dem Start.
 * @returns {null | { heute: string, stand: string }}
 */
export function fahrplanFuerBlatt(fahrplan, stunden, stunde) {
  if (!fahrplan || !Array.isArray(fahrplan.themen) || !fahrplan.themen.length || !stunde) return null;
  const datum = String(stunde.requestedDate || "");
  if (datum < (fahrplan.start || "")) return null;
  const bisher = stunden.filter((s) => s._id !== stunde._id && String(s.requestedDate || "") <= datum).concat(stunde);
  const plan = { ...fahrplan, themen: fahrplan.themen.map((t) => ({ ...t, sitztAm: t.sitztAm && t.sitztAm <= datum ? t.sitztAm : null })) };
  const u = fahrplanUebersicht(plan, bisher);
  const titel = new Map(u.themen.map((t, i) => [t.id, `${i + 1}. ${t.titel}`]));
  const heute = (stunde.diary?.fahrplan || [])
    .filter((l) => titel.has(l.id))
    .map((l) => `${titel.get(l.id)}${l.sitzt ? " (abgeschlossen)" : ""}`)
    .join(" · ");
  const naechstes = u.themen.find((t) => t.aktuell);
  const stand = `${u.fortschritt.sitzt} von ${u.fortschritt.gesamt} Themen abgeschlossen${naechstes ? ` · nächstes Thema: ${naechstes.titel}` : ""}`;
  return { heute, stand };
}
