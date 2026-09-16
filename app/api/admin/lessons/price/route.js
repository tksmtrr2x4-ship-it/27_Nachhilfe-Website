import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse } from "@/lib/adminError";
import { priceSuggestion } from "@/lib/lessons/db";

export async function GET(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const { searchParams } = new URL(request.url);
    const priceCents = await priceSuggestion(searchParams.get("studentId") || "", Number.parseInt(searchParams.get("duration"), 10));
    return Response.json({ priceCents });
  } catch (err) {
    return adminErrorResponse(err, "Stunden");
  }
}
