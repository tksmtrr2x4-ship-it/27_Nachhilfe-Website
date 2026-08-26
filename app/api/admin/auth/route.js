export async function POST(request) {
  const { pin } = await request.json();
  const expected = process.env.ADMIN_PIN || "";
  const ok = expected.length > 0 && pin === expected;
  return Response.json({ ok }, { status: ok ? 200 : 401 });
}
