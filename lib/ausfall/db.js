import { getBooking, updateBooking } from "@/lib/db";
import { berechneAusfall, AUSFALL_ARTEN, vorbereitungsSatzCent } from "@/lib/ausfall/berechnung";
import { AdminError } from "@/lib/adminError";
import { isLessonLocked } from "@/lib/lessons/rules";

// Versäumten Termin mit Ausfallvergütung markieren – und das Protokoll dazu
// fortschreiben. Die Stunde bleibt `heldStatus: "missed"` (sie hat nicht
// stattgefunden: Kalender, Statistik, Tagebuch bleiben wie bei jedem Ausfall).
// Neu ist `ausfall`: der berechnete Betrag samt Herleitung. Damit Listen,
// Offene-Posten und Zahlungen, die den Betrag aus `offerSnapshot.priceCents`
// lesen, den fälligen Betrag sehen, steht dort bis zur Rücknahme die
// Gesamtsumme; der ursprüngliche Stundenpreis bleibt in `ausfall.stundenpreisCent`.

export async function markiereAusfall({ id, art, vorbereitungMin, satzCent, absageAm, kanal, notiz, wartezeitEingehalten }) {
  const lesson = await getBooking(id);
  if (!lesson) throw new AdminError("Stunde nicht gefunden.", { status: 404 });
  if (lesson.offerSnapshot?.type !== "session") throw new AdminError("Nur Einzelstunden können versäumt werden.");
  if (lesson.status !== "confirmed") throw new AdminError("Nur bestätigte Termine können als versäumt markiert werden.");
  if (isLessonLocked(lesson)) throw new AdminError("Die Stunde ist schon abgerechnet – bitte zuerst die Rechnung bzw. Zahlung aufheben.", { status: 409 });
  if (!AUSFALL_ARTEN[art]) throw new AdminError("Bitte angeben, ob die Absage zu spät kam oder der Termin nicht wahrgenommen wurde.");

  const satz = Number.isInteger(satzCent) ? satzCent : vorbereitungsSatzCent(lesson.studentClass);
  if (!satz) throw new AdminError("Die Klassenstufe ist nicht lesbar – bitte den Satz für die Vorbereitung angeben.");

  const stundenpreisCent = lesson.ausfall?.stundenpreisCent ?? lesson.offerSnapshot?.priceCents ?? 0;
  let rechnung;
  try {
    rechnung = berechneAusfall({ art, stundenpreisCent, vorbereitungMin: Number(vorbereitungMin), satzCent: satz });
  } catch (err) {
    throw new AdminError(err.message);
  }

  const jetzt = new Date().toISOString();
  const eintrag = {
    am: jetzt,
    text: `${AUSFALL_ARTEN[art]} – Ausfallvergütung ${rechnung.prozent} % (${rechnung.stundenCent} ct) und Vorbereitung ${rechnung.vorbereitungMin} Min. zu ${rechnung.satzCent} ct/h (${rechnung.vorbereitungCent} ct), gesamt ${rechnung.totalCent} ct (AGB ${rechnung.termsVersion}).`,
  };
  const ausfall = {
    ...rechnung,
    markiertAm: jetzt,
    absageAm: String(absageAm || "").slice(0, 40) || null,
    kanal: String(kanal || "").slice(0, 60) || null,
    wartezeitEingehalten: art === "no_show" ? Boolean(wartezeitEingehalten) : null,
    notiz: String(notiz || "").slice(0, 500),
    protokoll: [...(lesson.ausfall?.protokoll || []), eintrag],
  };
  return updateBooking(id, {
    heldStatus: "missed",
    heldAt: null,
    ausfall,
    "offerSnapshot.priceCents": rechnung.totalCent,
  });
}

// Zurücknehmen, solange nichts abgerechnet ist: Stundenpreis kehrt zurück, der
// Protokolleintrag bleibt (wer wann was zurückgenommen hat).
export async function nimmAusfallZurueck({ id, grund }) {
  const lesson = await getBooking(id);
  if (!lesson?.ausfall) throw new AdminError("Für diese Stunde ist keine Ausfallvergütung vermerkt.", { status: 404 });
  if (isLessonLocked(lesson)) throw new AdminError("Die Ausfallvergütung ist schon in Rechnung gestellt oder bezahlt.", { status: 409 });
  const eintrag = { am: new Date().toISOString(), text: `Ausfallvergütung zurückgenommen${grund ? `: ${String(grund).slice(0, 200)}` : "."}` };
  return updateBooking(id, {
    ausfall: { ...lesson.ausfall, aufgehoben: true, protokoll: [...(lesson.ausfall.protokoll || []), eintrag] },
    "offerSnapshot.priceCents": lesson.ausfall.stundenpreisCent,
  });
}

// Hängt einen Protokolleintrag an (z. B. „Rechnung R-2026-… ausgestellt").
export async function ausfallProtokoll(id, text) {
  const lesson = await getBooking(id);
  if (!lesson?.ausfall) return null;
  const eintrag = { am: new Date().toISOString(), text: String(text).slice(0, 300) };
  return updateBooking(id, { "ausfall.protokoll": [...(lesson.ausfall.protokoll || []), eintrag] });
}
