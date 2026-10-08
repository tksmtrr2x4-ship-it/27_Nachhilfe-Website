// Günstigste aktive Einzelstunde, bevorzugt 45 Minuten, für die Zeile „Ab … €“
// auf der Startseite. Ohne aktive Einzelstunde entfällt die Zeile (null).
export function abPreis(offers) {
  const stunden = (offers || []).filter((o) => o.type === "session" && o.priceCents > 0 && o.durationMinutes > 0);
  const kandidaten = stunden.some((o) => o.durationMinutes === 45) ? stunden.filter((o) => o.durationMinutes === 45) : stunden;
  if (kandidaten.length === 0) return null;
  const guenstigste = kandidaten.reduce((a, b) => (b.priceCents < a.priceCents ? b : a));
  const euro = guenstigste.priceCents % 100 === 0 ? String(guenstigste.priceCents / 100) : (guenstigste.priceCents / 100).toFixed(2).replace(".", ",");
  return `Ab ${euro} € pro ${guenstigste.durationMinutes} Minuten`;
}
