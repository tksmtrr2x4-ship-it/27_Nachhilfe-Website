import crypto from "crypto";
import { getBookingByMeetingToken } from "@/lib/db";

// Zugang zum Unterrichtsraum (/meeting/<token>).
//
//   Gast – wer den Link kennt: Der lange Zufallstoken der Buchung ist zugleich
//          der Schlüssel (wie bisher bei Jitsi). Gesperrt, wenn die Stunde
//          storniert ist, Jill den Raum geschlossen hat oder vor dem Video
//          noch die Rechnungsadresse fehlt.
//   Host – Jill, aus der Verwaltung: Die Verwaltung stellt ein kurzlebiges,
//          signiertes Ticket für genau diesen Raum aus
//          (app/api/admin/raum/[token]). Ohne Ticket ist man Gast.
//
// Der Schlüssel für die Tickets ist aus AKTEN_SCHLUESSEL abgeleitet (nur in
// der Server-Umgebung).

export const TICKET_STUNDEN = 8;

function schluessel() {
  const roh = Buffer.from(String(process.env.AKTEN_SCHLUESSEL || ""), "base64");
  if (roh.length < 32) throw new Error("AKTEN_SCHLUESSEL fehlt – Host-Tickets nicht möglich.");
  return crypto.createHmac("sha256", roh).update("lernsprung-raum:host").digest();
}

function signatur(text) {
  return crypto.createHmac("sha256", schluessel()).update(text).digest("base64url");
}

export function hostTicket(token, { jetzt = Date.now() } = {}) {
  const bis = jetzt + TICKET_STUNDEN * 3600 * 1000;
  const inhalt = `${token}.${bis}`;
  return `${bis}.${signatur(inhalt)}`;
}

export function hostTicketGueltig(token, ticket, { jetzt = Date.now() } = {}) {
  const [bis, sig] = String(ticket || "").split(".");
  if (!bis || !sig || Number(bis) < jetzt) return false;
  const erwartet = signatur(`${token}.${bis}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(erwartet);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Kostenpflichtige Online-Stunde: Video erst nach Rechnungsadresse und
// Zahlungszusage (MeetingPayGate). Kennenlernen und 0-€-Termine nie.
export function brauchtZahlungsschritt(booking) {
  const preis = booking?.offerSnapshot?.priceCents || 0;
  const freigeschaltet = booking?.paymentMethod === "invoice" && Boolean(booking?.invoiceCommitmentAt);
  return (
    booking?.offerSnapshot?.type === "session" &&
    booking?.locationType === "online" &&
    preis > 0 &&
    booking?.status !== "paid" &&
    !freigeschaltet
  );
}

// Wer ist das? → { rolle: "host"|"gast", booking } oder { fehler, status }
export async function teilnehmerFuer(token, ticket) {
  if (!/^[a-f0-9]{16,64}$/.test(String(token || ""))) return { fehler: "Raum nicht gefunden.", status: 404 };
  const booking = await getBookingByMeetingToken(token);
  if (!booking) return { fehler: "Raum nicht gefunden.", status: 404 };
  if (ticket && hostTicketGueltig(token, ticket)) return { rolle: "host", booking };
  if (booking.status === "cancelled") return { fehler: "Dieser Termin wurde storniert.", status: 410 };
  if (booking.raumGeschlossenAt) return { fehler: "Diese Stunde ist beendet – der Raum ist geschlossen.", status: 410 };
  if (brauchtZahlungsschritt(booking)) return { fehler: "Bitte zuerst die Rechnungsadresse angeben.", status: 402 };
  return { rolle: "gast", booking };
}

// STUN und TURN laufen auf dem eigenen Server (coturn, TURN_URLS), es wird
// kein fremder Dienst gefragt. Zugangsdaten nach „use-auth-secret“:
// Nutzername = Ablaufzeit, Passwort = HMAC-SHA1 mit dem gemeinsamen
// Geheimnis (TURN_SECRET); sie gelten nur einige Stunden.
//
// Ohne Konfiguration (Entwicklung) ein öffentlicher STUN-Server – reicht
// im selben Netz bzw. zu Hause.
export function iceServer({ jetzt = Date.now() } = {}) {
  const geheim = String(process.env.TURN_SECRET || "").trim();
  const urls = String(process.env.TURN_URLS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (!geheim || !urls.length) return [{ urls: ["stun:stun.l.google.com:19302"] }];
  const username = String(Math.floor(jetzt / 1000) + TICKET_STUNDEN * 3600);
  const credential = crypto.createHmac("sha1", geheim).update(username).digest("base64");
  const stun = urls.filter((u) => u.startsWith("stun:"));
  const turn = urls.filter((u) => !u.startsWith("stun:"));
  return [...(stun.length ? [{ urls: stun }] : []), ...(turn.length ? [{ urls: turn, username, credential }] : [])];
}
