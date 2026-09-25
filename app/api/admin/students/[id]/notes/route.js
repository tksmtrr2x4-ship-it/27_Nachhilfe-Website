import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, assertValid } from "@/lib/adminError";
import { addNote } from "@/lib/students/db";
import { normalizeNoteInput } from "@/lib/students/validation";

export async function POST(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const { id } = await params;
    const { data, problems } = normalizeNoteInput(await request.json());
    assertValid(problems);
    return Response.json({ student: await addNote(id, data) });
  } catch (err) {
    return adminErrorResponse(err, "Notizen");
  }
}
