import crypto from "crypto";
import { getDb } from "@/lib/mongo";
import { getBooking, getBookingByMeetingToken, updateBooking } from "@/lib/db";

// Freie Räume: Unterrichtsräume ohne Buchung – für ein Kennenlernen, eine
// Vertretung oder einfach „schnell einen Raum“. Jill legt sie in der
// Verwaltung an (Stunden → Räume) und teilt den Link. Sie tauchen nirgends in
// Stunden, Rechnungen oder Journal auf.
//
// Im Raum selbst (lib/raum/zugang.js, Unterlagen, Schließen) sehen freie
// Räume aus wie eine Buchung: alsSicht() liefert dieselben Felder.

async function col() {
  return (await getDb()).collection("raeume");
}

function text(wert, max) {
  return String(wert || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

export async function raumAnlegen({ titel, gastName } = {}) {
  const raum = {
    _id: `raum-${crypto.randomBytes(8).toString("hex")}`,
    token: crypto.randomBytes(16).toString("hex"),
    titel: text(titel, 80) || "Unterrichtsraum",
    gastName: text(gastName, 60),
    erstelltAm: new Date().toISOString(),
    raumGeschlossenAt: null,
  };
  await (await col()).insertOne(raum);
  return raum;
}

export async function raeumeListe() {
  return (await col()).find({}).sort({ erstelltAm: -1 }).limit(200).toArray();
}

export async function raumHolen(id) {
  if (!String(id || "").startsWith("raum-")) return null;
  return (await col()).findOne({ _id: String(id) });
}

export async function raumAendern(id, patch) {
  const erlaubt = {};
  if ("titel" in patch) erlaubt.titel = text(patch.titel, 80) || "Unterrichtsraum";
  if ("gastName" in patch) erlaubt.gastName = text(patch.gastName, 60);
  if ("raumGeschlossenAt" in patch) erlaubt.raumGeschlossenAt = patch.raumGeschlossenAt || null;
  return (await col()).findOneAndUpdate({ _id: String(id) }, { $set: erlaubt }, { returnDocument: "after" });
}

export async function raumLoeschen(id) {
  const res = await (await col()).deleteOne({ _id: String(id) });
  return res.deletedCount === 1;
}

// Freier Raum in der Form einer Buchung (nur die Felder, die der Raum nutzt).
export function alsSicht(raum) {
  return {
    _id: raum._id,
    meetingToken: raum.token,
    status: "confirmed",
    raumGeschlossenAt: raum.raumGeschlossenAt || null,
    studentName: raum.gastName || "Gast",
    subject: raum.titel,
    frei: true,
  };
}

// Raum zu einem Link-Token: zuerst Buchungen, dann freie Räume.
export async function sichtFuerToken(token) {
  if (!token) return null;
  const booking = await getBookingByMeetingToken(token);
  if (booking) return booking;
  const raum = await (await col()).findOne({ token: String(token) });
  return raum ? alsSicht(raum) : null;
}

// Zu einer ID (Buchung oder „raum-…“) – fürs Aufräumen der Unterlagen.
export async function sichtFuerId(id) {
  if (String(id).startsWith("raum-")) {
    const raum = await raumHolen(id);
    return raum ? alsSicht(raum) : null;
  }
  return getBooking(id);
}

export async function geschlossenMarkieren(sicht, wann) {
  if (sicht.frei) return raumAendern(sicht._id, { raumGeschlossenAt: wann });
  return updateBooking(sicht._id, { raumGeschlossenAt: wann });
}
