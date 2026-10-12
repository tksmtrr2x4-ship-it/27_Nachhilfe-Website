import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { getStudent } from "@/lib/students/db";
import { passwortVon, zugangKonfiguriert } from "@/lib/kunden/zugang";
import { empfaengerFuer, sendeZugang } from "@/lib/kunden/zugangVersand";

// Zugang zur Schülerakte im Schülerprofil: das Passwort im Klartext (nur
// hier, nur für die Verwaltung), wohin es zuletzt ging und wohin es gehen
// würde.
//
// POST { aktion: "neu" }    – neues Passwort, per Mail an die Familie; das
//                             alte gilt nicht mehr, offene Anmeldungen enden
// POST { aktion: "erneut" } – das vorhandene noch einmal schicken
async function stand(student) {
  const empfaenger = await empfaengerFuer(student);
  return {
    passwort: passwortVon(student),
    erstelltAm: student.zugang?.erstelltAm || null,
    gesendetAm: student.zugang?.gesendetAm || null,
    gesendetAn: student.zugang?.gesendetAn || "",
    empfaenger: empfaenger?.to || "",
  };
}

export async function GET(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  if (!zugangKonfiguriert()) return Response.json({ error: "AKTEN_SCHLUESSEL fehlt in der Server-Umgebung." }, { status: 503 });
  const { id } = await params;
  const student = await getStudent(id);
  if (!student) return Response.json({ error: "Profil nicht gefunden." }, { status: 404 });
  return Response.json(await stand(student), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  if (!zugangKonfiguriert()) return Response.json({ error: "AKTEN_SCHLUESSEL fehlt in der Server-Umgebung." }, { status: 503 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const aktion = body.aktion === "erneut" ? "erneut" : "neu";
  const student = await getStudent(id);
  if (!student) return Response.json({ error: "Profil nicht gefunden." }, { status: 404 });

  const ergebnis = await sendeZugang(id, { anlass: aktion === "neu" ? (student.zugang ? "geaendert" : "neu") : "erneut" });
  const neu = await getStudent(id);
  return Response.json({ ...(await stand(neu)), an: ergebnis.an || "", hinweis: ergebnis.fehler || "" }, { headers: { "Cache-Control": "no-store" } });
}
