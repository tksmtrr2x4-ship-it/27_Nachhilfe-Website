export function isAdminAuthorized(request) {
  const expected = process.env.ADMIN_PIN || "";
  const provided = request.headers.get("x-admin-pin") || "";
  return expected.length > 0 && provided === expected;
}

export function forbiddenResponse() {
  return Response.json(
    { error: "Keine Berechtigung für diese Aktion." },
    { status: 403 }
  );
}
