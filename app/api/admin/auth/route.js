import { endSession } from "@/lib/auth/sessions";

// Abmelden: Sitzung serverseitig beenden, nicht nur im Browser vergessen.
// Die Anmeldung selbst läuft über /api/admin/auth/start und /finish.
export async function DELETE(request) {
  await endSession(request.headers.get("x-admin-session") || "");
  return Response.json({ ok: true });
}
