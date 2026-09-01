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

export function locationLabel(booking) {
  if (booking?.locationType === "student") {
    return `Beim Kunden${booking.locationAddress ? ` – ${booking.locationAddress}` : ""}`;
  }
  if (booking?.locationType === "tutor") return "Bei der Lehrkraft";
  return "";
}
