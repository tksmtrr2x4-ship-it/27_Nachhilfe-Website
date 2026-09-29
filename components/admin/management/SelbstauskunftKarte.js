"use client";

import { card } from "@/components/admin/ui";
import { SCHOOL_TYPES } from "@/lib/students/validation";
import { LOCATION_TYPES } from "@/lib/students/validation";

// Was die Familie in der Schülerakte selbst eingetragen hat – die Angaben
// vom Aufnahmebogen, für die es im Datenmodell kein eigenes Feld gibt.
// Nur zum Lesen: Geändert wird entweder von der Familie unter /konto oder
// über die Stammdaten daneben.
function Zeile({ label, wert }) {
  if (!wert) return null;
  return (
    <div className="flex gap-3">
      <dt className="w-40 shrink-0 text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-slate-800">{wert}</dd>
    </div>
  );
}

export default function SelbstauskunftKarte({ auskunft }) {
  if (!auskunft) return null;
  const { eltern = {}, schueler = {}, bedarf = [], organisation = {}, sonstiges = {} } = auskunft;

  return (
    <div className={`${card} min-w-0`}>
      <h3 className="font-semibold text-slate-900">Selbstauskunft</h3>
      <p className="mt-0.5 text-xs text-slate-500">Von der Familie über die Schülerakte eingetragen.</p>

      <dl className="mt-3 space-y-1.5 text-sm">
        <Zeile label="Anrede" wert={eltern.anrede} />
        <Zeile label="Verhältnis zum Kind" wert={eltern.beziehung} />
        <Zeile label="Weitere Nummer" wert={eltern.telefon2} />
        <Zeile label="Erreichbar" wert={eltern.erreichbarkeit} />
        <Zeile label="Schule" wert={[schueler.schule, SCHOOL_TYPES[schueler.schulart]].filter(Boolean).join(" · ")} />
        <Zeile label="Häufigkeit" wert={organisation.haeufigkeit} />
        <Zeile label="Dauer je Termin" wert={organisation.dauer} />
        <Zeile label="Gewünschter Ort" wert={LOCATION_TYPES[organisation.ort]} />
        <Zeile label="Mögliche Zeiten" wert={organisation.zeiten} />
        <Zeile label="Aufmerksam durch" wert={sonstiges.aufmerksamDurch} />
        <Zeile label="Absprachen" wert={sonstiges.absprachen} />
      </dl>

      {bedarf.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {bedarf.map((f, i) => (
            <li key={i} className="rounded-xl bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">
                {f.fach}
                {f.niveau ? ` (${f.niveau === "basis" ? "Basisfach" : "Leistungsfach"})` : ""}
                {f.note ? ` · aktuell ${f.note}` : ""}
              </p>
              <dl className="mt-1 space-y-1">
                <Zeile label="Ziel" wert={f.ziel} />
                <Zeile label="Nächste Prüfung" wert={f.naechstePruefung} />
                <Zeile label="Material" wert={f.material} />
              </dl>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
