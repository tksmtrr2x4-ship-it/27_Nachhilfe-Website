import { formatDate } from "@/lib/format";

// Liefert den Anzeigetext für Kund:innen, wenn der Shop geschlossen ist –
// z.B. "Bald wieder offen" mit Datum, oder eine freie Nachricht der Lehrkraft.
export function getShopStatus(settings) {
  if (settings.shopOpen) return { closed: false };

  const parts = [];
  if (settings.shopReopensAt) {
    parts.push(`Ab dem ${formatDate(settings.shopReopensAt)} wieder buchbar.`);
  }
  if (settings.shopClosedMessage) {
    parts.push(settings.shopClosedMessage);
  }
  if (parts.length === 0) {
    parts.push("Aktuell sind leider keine neuen Buchungen möglich.");
  }

  return { closed: true, message: parts.join(" ") };
}
