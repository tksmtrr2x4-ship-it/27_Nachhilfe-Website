const MODES = ["online", "presence", "both"];

// Liest die Angebots-Felder aus einem Request-Body. `partial: true` (Patch)
// nimmt nur tatsächlich übergebene Felder auf, `partial: false` (Create)
// liefert für alles einen sinnvollen Default.
export function normalizeOfferInput(body, { partial } = { partial: false }) {
  const out = {};
  const has = (key) => !partial || body[key] !== undefined;

  if (has("type")) out.type = body.type === "session" ? "session" : "package";
  if (has("title")) out.title = (body.title || "").trim() || "Neues Angebot";
  if (has("subject")) out.subject = (body.subject || "").trim();
  if (has("durationLabel")) out.durationLabel = (body.durationLabel || "").trim();
  if (has("durationMinutes")) {
    out.durationMinutes = Number.isFinite(body.durationMinutes) ? body.durationMinutes : null;
  }
  if (has("description")) out.description = (body.description || "").trim();
  if (has("features")) out.features = Array.isArray(body.features) ? body.features : [];
  if (has("priceCents")) out.priceCents = Number.isFinite(body.priceCents) ? body.priceCents : 0;
  if (has("active")) out.active = body.active !== undefined ? Boolean(body.active) : true;
  if (has("order")) out.order = Number.isFinite(body.order) ? body.order : undefined;

  // Strukturierte Paket-Felder für die automatische Streichpreis-Berechnung.
  if (has("sessionCount")) out.sessionCount = Number(body.sessionCount) || null;
  if (has("sessionMinutes")) out.sessionMinutes = Number(body.sessionMinutes) || null;
  if (has("weeks")) out.weeks = Number(body.weeks) || null;
  if (has("mode")) out.mode = MODES.includes(body.mode) ? body.mode : "both";
  if (has("catchmentAreaText")) out.catchmentAreaText = (body.catchmentAreaText || "").trim();
  if (has("cancellationText")) out.cancellationText = (body.cancellationText || "").trim();
  if (has("validityText")) out.validityText = (body.validityText || "").trim();

  return out;
}
