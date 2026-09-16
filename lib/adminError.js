// Fachlicher Fehler in Admin-Routen (Schüler, Stunden, Buchhaltung): wird mit
// Statuscode und optionaler Problemliste an den Client gegeben; alles andere
// wird als 500 ohne interne Details beantwortet.
export class AdminError extends Error {
  constructor(message, { status = 400, problems = [] } = {}) {
    super(message);
    this.status = status;
    this.problems = problems;
  }
}

export function adminErrorResponse(err, context = "Admin-API") {
  if (err instanceof AdminError) {
    return Response.json({ error: err.message, problems: err.problems }, { status: err.status });
  }
  console.error(`${context}-Fehler:`, err);
  return Response.json({ error: "Interner Fehler. Bitte später erneut versuchen." }, { status: 500 });
}

export function assertValid(problems) {
  if (problems.length > 0) throw new AdminError(problems[0], { problems });
}

export function todayIsoBerlin() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}
