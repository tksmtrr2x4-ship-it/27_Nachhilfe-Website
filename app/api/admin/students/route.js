import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, assertValid } from "@/lib/adminError";
import { createStudent, listStudentsWithStats, listUnassignedBookings } from "@/lib/students/db";
import { listCustomers } from "@/lib/invoicing/db";
import { normalizeStudentInput } from "@/lib/students/validation";

export async function GET(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const [students, unassigned, customers] = await Promise.all([listStudentsWithStats(), listUnassignedBookings(), listCustomers()]);
    return Response.json({
      students,
      unassignedBookings: unassigned,
      customers: customers.map((c) => ({ _id: c._id, name: c.name, email: c.email })),
    });
  } catch (err) {
    return adminErrorResponse(err, "Schüler");
  }
}

export async function POST(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const { data, problems } = normalizeStudentInput(await request.json());
    assertValid(problems);
    const student = await createStudent(data);
    return Response.json({ student });
  } catch (err) {
    return adminErrorResponse(err, "Schüler");
  }
}
