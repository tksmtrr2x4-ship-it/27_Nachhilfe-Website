import test from "node:test";
import assert from "node:assert/strict";
import { lineFromBooking } from "@/lib/invoicing/db";
import { AGB_SECTIONS } from "@/lib/legal/agb";
import { PAYMENT_METHODS, INCOME_CATEGORIES } from "@/lib/bookkeeping/categories";

test("Paket-Rechnungsposition: Titel, Fach, Preis, Bestätigungstag in Berliner Zeit", () => {
  const line = lineFromBooking({
    _id: "b1",
    subject: "Mathematik (Basisfach)",
    confirmedAt: "2026-09-17T22:30:00Z",
    offerSnapshot: { type: "package", title: "Back to school Paket", priceCents: 17000 },
  });
  assert.equal(line.date, "2026-09-18");
  assert.equal(line.unitPriceCents, 17000);
  assert.equal(line.minutes, null);
  assert.match(line.description, /Back to school Paket/);
  assert.match(line.description, /Mathematik/);
});

test("Einzelstunden-Position bleibt unverändert", () => {
  const line = lineFromBooking({
    _id: "b2",
    subject: "Physik",
    requestedDate: "2026-09-20",
    offerSnapshot: { type: "session", durationMinutes: 45, priceCents: 2000 },
  });
  assert.deepEqual(line, { date: "2026-09-20", description: "Nachhilfe Physik", minutes: 45, quantity: 1, unitPriceCents: 2000, bookingId: "b2" });
});

test("Stripe ist aus AGB und Buchhaltungs-Auswahl verschwunden", () => {
  const agb = JSON.stringify(AGB_SECTIONS);
  assert.doesNotMatch(agb, /Stripe|Online-Zahlung/);
  assert.match(agb, /Pakete werden nach Vertragsschluss per Rechnung abgerechnet/);
  assert.doesNotMatch(JSON.stringify(PAYMENT_METHODS), /Stripe/);
  assert.equal(INCOME_CATEGORIES.tutoring_online, undefined);
});
