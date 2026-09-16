import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse } from "@/lib/adminError";
import { deleteNote } from "@/lib/students/db";

export async function DELETE(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const { id, noteId } = await params;
    return Response.json({ student: await deleteNote(id, noteId) });
  } catch (err) {
    return adminErrorResponse(err, "Notizen");
  }
}
