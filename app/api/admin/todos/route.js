import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { AdminError, adminErrorResponse } from "@/lib/adminError";
import { legeTodoAn, listeTodos } from "@/lib/admin/todos";

export async function GET(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    return Response.json({ todos: await listeTodos() });
  } catch (err) {
    return adminErrorResponse(err, "To-dos");
  }
}

export async function POST(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const body = await request.json();
    if (!String(body?.text || "").trim()) throw new AdminError("Bitte einen Text angeben.");
    return Response.json({ todo: await legeTodoAn(body) }, { status: 201 });
  } catch (err) {
    return adminErrorResponse(err, "To-dos");
  }
}
