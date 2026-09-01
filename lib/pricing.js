// Preislogik für die Angebotskarten. Der Streichpreis (Vergleichspreis) wird
// NICHT automatisch berechnet, sondern von der Lehrkraft im Admin-Bereich
// selbst festgelegt (offer.listPriceCents) – so bleibt volle Kontrolle über
// Rabatte und Aktionen.

// Ersparnis in Cent und Prozent gegenüber dem Vergleichspreis. Nur wenn
// der Endpreis wirklich unter dem Vergleichspreis liegt – sonst keine
// (falsche) Rabatt-Behauptung.
export function computeSavings(listPriceCents, priceCents) {
  if (!listPriceCents || listPriceCents <= priceCents) return null;
  const savingCents = listPriceCents - priceCents;
  const percent = Math.round((savingCents / listPriceCents) * 100);
  if (percent <= 0) return null;
  return { savingCents, percent };
}

export function computeTotalHours(sessionCount, sessionMinutes) {
  if (!sessionCount || !sessionMinutes) return null;
  return Math.round(((sessionCount * sessionMinutes) / 60) * 10) / 10;
}

// Baut die Dauer-/Umfangs-Zeile für eine Angebotskarte aus den
// strukturierten Feldern. Fällt auf das alte freie `durationLabel` zurück,
// falls ein Angebot (noch) keine strukturierten Werte hat.
export function buildDurationSummary(offer) {
  if (offer.type === "session") {
    return offer.durationLabel || `${offer.durationMinutes || 45} Minuten`;
  }
  if (offer.sessionCount && offer.sessionMinutes) {
    const hours = computeTotalHours(offer.sessionCount, offer.sessionMinutes);
    const parts = [
      `${offer.sessionCount} Einheiten à ${offer.sessionMinutes} Min.`,
      `${hours} Std. gesamt`,
    ];
    if (offer.weeks) parts.push(`Laufzeit ${offer.weeks} Wochen`);
    return parts.join(" · ");
  }
  return offer.durationLabel || "";
}

export const MODE_LABEL = {
  online: "Online",
  presence: "Vor Ort",
  both: "Online oder vor Ort",
};
