// Ein Verzeichnis für alle Status-Bezeichnungen und ihre Farbe. Vorher lagen
// dieselben Listen vierfach in den Panels, mit abweichenden Wörtern für
// denselben Zustand ("Bezahlt" / "Als bezahlt buchen" / "verbucht").
//
// Die Werte müssen zu den serverseitigen Listen passen:
// - booking:  ALLOWED_STATUSES in app/api/admin/bookings/[id]/route.js
// - invoice:  Statuswechsel in lib/invoicing/db.js
// - student:  STUDENT_STATUS in lib/students/validation.js
// - entry:    ENTRY_TYPES in lib/bookkeeping/categories.js
// tests/adminUi.test.mjs prüft genau diese Deckungsgleichheit.

export const STATUS = {
  booking: {
    pending: { label: "Anfrage offen", tone: "amber" },
    confirmed: { label: "Bestätigt", tone: "emerald" },
    paid: { label: "Bezahlt", tone: "emerald" },
    cancelled: { label: "Storniert", tone: "slate" },
  },
  invoice: {
    draft: { label: "Entwurf", tone: "slate" },
    issuing: { label: "Wird ausgestellt", tone: "amber" },
    issued: { label: "Ausgestellt", tone: "sky" },
    sent: { label: "Versendet", tone: "sky" },
    paid: { label: "Bezahlt", tone: "emerald" },
    cancelled: { label: "Storniert", tone: "slate" },
    overdue: { label: "Überfällig", tone: "red" },
  },
  student: {
    active: { label: "Aktiv", tone: "emerald" },
    paused: { label: "Pausiert", tone: "amber" },
    ended: { label: "Beendet", tone: "slate" },
  },
  entry: {
    income: { label: "Einnahme", tone: "emerald" },
    expense: { label: "Ausgabe", tone: "amber" },
  },
  limit: {
    ok: { label: "Im Rahmen", tone: "emerald" },
    warning: { label: "Grenze nah", tone: "amber" },
    exceeded: { label: "Grenze überschritten", tone: "red" },
  },
};

export function statusLabel(kind, value) {
  return STATUS[kind]?.[value]?.label || value || "–";
}

export function statusTone(kind, value) {
  return STATUS[kind]?.[value]?.tone || "slate";
}
