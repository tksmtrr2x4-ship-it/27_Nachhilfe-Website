// CSV mit ; als Trenner (Excel/Numbers im deutschen Gebietsschema) und BOM,
// damit Umlaute direkt korrekt angezeigt werden. Zellen, die mit =, +, - oder @
// beginnen, werden entschärft (CSV-/Formel-Injection).
export function csvCell(value) {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function euro(cents) {
  return ((cents || 0) / 100).toFixed(2).replace(".", ",");
}

export function toCsv(rows) {
  return "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
