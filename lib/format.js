export function formatPrice(cents) {
  return (cents / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

// "2026-09-15" -> "15.09.2026"
export function formatDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}.${month}.${year}`;
}

// Voller ISO-Zeitstempel (z.B. aus createdAt/checkedAt) -> "15.09.2026, 14:03 Uhr".
export function formatDateTime(isoTimestamp) {
  if (!isoTimestamp) return "";
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return isoTimestamp;
  const datePart = date.toLocaleDateString("de-DE");
  const timePart = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return `${datePart}, ${timePart} Uhr`;
}

// Für interne Ansichten (Admin-Tabelle, Benachrichtigungsmail an die Lehrkraft).
export function locationLabel(booking) {
  if (booking?.locationType === "student") {
    return `Vor Ort beim Kunden${booking.locationAddress ? ` – ${booking.locationAddress}` : ""}`;
  }
  if (booking?.locationType === "tutor") return "Bei der Lehrkraft";
  if (booking?.locationType === "online") return "Online";
  return "";
}

// Für die Bestätigungsseite/-mail an die Familie – im Du/Sie-Ton der
// jeweiligen Seite, nicht die interne Business-Formulierung.
export function locationLabelForCustomer(booking) {
  if (booking?.locationType === "student") {
    return `Bei dir zuhause${booking.locationAddress ? ` – ${booking.locationAddress}` : ""}`;
  }
  if (booking?.locationType === "tutor") return "Bei der Lehrkraft";
  if (booking?.locationType === "online") return "Online per Video-Call";
  return "";
}
