import { getSettings, updateSettings } from "@/lib/db";
import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";

export async function GET(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const settings = await getSettings();
  return Response.json({ settings });
}

// Eine USt-IdNr. beginnt immer mit einem Länderpräfix (DE123456789). Eine
// freistehende 11-stellige Ziffernfolge ist dagegen das Format der
// persönlichen Steuer-Identifikationsnummer nach § 139b AO. Die darf niemals
// im Impressum landen: Sie ist ein lebenslanges Personenkennzeichen, nur für
// den Verkehr mit Finanzbehörden bestimmt, und § 5 Abs. 1 Nr. 6 DDG verlangt
// ausschließlich eine USt-IdNr oder Wirtschafts-IdNr. Deshalb wird sie hier
// serverseitig abgewiesen – nicht nur im Formular ausgeblendet.
const STEUER_ID_PATTERN = /^\d{2}[\s/.-]?\d{3}[\s/.-]?\d{3}[\s/.-]?\d{3}$/;

export async function PATCH(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const body = await request.json();
  if (typeof body.ustId === "string" && STEUER_ID_PATTERN.test(body.ustId.trim())) {
    return Response.json(
      {
        error:
          "Das sieht nach der persönlichen Steuer-Identifikationsnummer (11 Ziffern, § 139b AO) aus. Diese darf nicht im Impressum stehen. Hier gehört ausschließlich eine USt-IdNr. mit Länderpräfix hin (z. B. DE123456789) – ohne eine solche bleibt das Feld leer.",
      },
      { status: 400 }
    );
  }
  const settings = await updateSettings(body);
  return Response.json({ settings });
}
