import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { AdminError, adminErrorResponse } from "@/lib/adminError";
import { getStudent, updateStudent } from "@/lib/students/db";
import { getCustomer } from "@/lib/invoicing/db";
import { sendeAgbMail } from "@/lib/legal/agbMail";
import { TERMS_VERSION } from "@/lib/legal/terms";

// AGB-Übermittlung für telefonisch/persönlich vereinbarte Nachhilfe.
//   { senden: true }  → Mail mit AGB und Widerrufsbelehrung an den
//                       Rechnungsempfänger, Versand wird vermerkt
//   { senden: false } → die AGB sind bereits mit einer Bestätigung versendet
//                       worden (z. B. beim Anlegen des Profils), nur vermerken
export async function POST(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const student = await getStudent(id);
    if (!student) throw new AdminError("Profil nicht gefunden.", { status: 404 });
    const jetzt = new Date().toISOString();
    let mailGesendetAm = null;
    if (body.senden === true) {
      const customer = student.customerId ? await getCustomer(student.customerId) : null;
      const to = customer?.email || student.email;
      if (!to) throw new AdminError("Es ist keine E-Mail-Adresse hinterlegt, an die die AGB gehen könnten.");
      const res = await sendeAgbMail({ to, name: customer?.name, schueler: student.name });
      if (res.skipped || res.error) throw new AdminError("Die E-Mail konnte nicht versendet werden.", { status: 502 });
      mailGesendetAm = jetzt;
    }
    const agb = {
      version: TERMS_VERSION,
      uebermitteltAm: jetzt,
      kanal: "telefon",
      mailGesendetAm,
      manuellVermerkt: body.senden !== true,
    };
    const updated = await updateStudent(id, { agb });
    return Response.json({ student: updated });
  } catch (err) {
    return adminErrorResponse(err, "AGB");
  }
}
