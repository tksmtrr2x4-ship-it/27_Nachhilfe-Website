import { getSettings, updateSettings } from "@/lib/db";
import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";

export async function GET(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const settings = await getSettings();
  return Response.json({ settings });
}

export async function PATCH(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const body = await request.json();
  const settings = await updateSettings(body);
  return Response.json({ settings });
}
