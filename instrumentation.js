// Läuft einmal beim Start des Servers (Next.js). Hier nur das stündliche
// Aufräumen der Unterlagen im Unterrichtsraum (lib/raum/aufraeumen.js).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { starteAufraeumen } = await import("@/lib/raum/aufraeumen");
  starteAufraeumen();
}
