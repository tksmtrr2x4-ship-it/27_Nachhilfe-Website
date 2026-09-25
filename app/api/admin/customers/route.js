import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { listCustomers, createCustomer, findCustomerByEmail } from "@/lib/invoicing/db";
import { normalizeRecipient } from "@/lib/invoicing/validation";
import { invoiceErrorResponse } from "@/lib/invoicing/api";

export async function GET(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const customers = await listCustomers();
  return Response.json({ customers });
}

// Manuell angelegte:r Kund:in (z.B. Bestandskund:in ohne Online-Buchung).
export async function POST(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const body = await request.json();
    const email = String(body.email || "").trim();
    if (!email) return Response.json({ error: "E-Mail-Adresse fehlt." }, { status: 400 });
    if (await findCustomerByEmail(email)) {
      return Response.json({ error: "Zu dieser E-Mail-Adresse existiert bereits ein Kundendatensatz." }, { status: 409 });
    }
    const address = normalizeRecipient(body);
    const customer = await createCustomer({
      name: address.name,
      street: address.street,
      zip: address.zip,
      city: address.city,
      country: address.country,
      email,
      phone: String(body.phone || "").trim(),
      studentName: String(body.studentName || "").trim(),
    });
    return Response.json({ customer });
  } catch (err) {
    return invoiceErrorResponse(err);
  }
}
