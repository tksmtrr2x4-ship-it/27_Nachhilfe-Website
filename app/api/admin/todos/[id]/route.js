import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { AdminError, adminErrorResponse } from "@/lib/adminError";
import { loescheTodo, setzeErledigt } from "@/lib/admin/todos";

export async function PATCH(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const { id } = await params;
    const body = await request.json();
    const todo = await setzeErledigt(id, body?.erledigt === true);
    if (!todo) throw new AdminError("To-do nicht gefunden.", { status: 404 });
    return Response.json({ todo });
  } catch (err) {
    return adminErrorResponse(err, "To-dos");
  }
}

export async function DELETE(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const { id } = await params;
    if (!(await loescheTodo(id))) throw new AdminError("To-do nicht gefunden.", { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    return adminErrorResponse(err, "To-dos");
  }
}
