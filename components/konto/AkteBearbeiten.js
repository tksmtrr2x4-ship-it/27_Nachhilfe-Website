"use client";

import { useEffect, useState } from "react";
import SelbstauskunftFormular, { LEER } from "@/components/konto/SelbstauskunftFormular";

// Die eigene Akte pflegen: ein Kind ändern oder ein weiteres anlegen.
//
// Die Angaben der Eltern kommen aus dem Konto, die des Kindes aus der Akte.
// Wo bei einer alten Akte noch keine Selbstauskunft hinterlegt ist (etwa weil
// die Lehrkraft sie angelegt hat), werden die vorhandenen Felder übernommen –
// so steht die Familie nicht vor einem leeren Formular.
function ausAkte(kunde, schueler) {
  const auskunft = schueler?.selbstauskunft || {};
  return {
    ...LEER,
    ...auskunft,
    eltern: {
      ...LEER.eltern,
      ...(auskunft.eltern || {}),
      name: kunde.name || auskunft.eltern?.name || "",
      email: kunde.email || "",
      telefon: kunde.phone || auskunft.eltern?.telefon || "",
      strasse: kunde.street || auskunft.eltern?.strasse || "",
      plz: kunde.zip || auskunft.eltern?.plz || "",
      ort: kunde.city || auskunft.eltern?.ort || "",
    },
    schueler: schueler
      ? {
          ...LEER.schueler,
          ...(auskunft.schueler || {}),
          name: schueler.name || "",
          klasse: schueler.studentClass || "",
          schulart: schueler.schoolType || "",
          schule: schueler.school || "",
          email: schueler.email || "",
          telefon: schueler.phone || "",
        }
      : LEER.schueler,
    bedarf:
      auskunft.bedarf?.length > 0
        ? auskunft.bedarf
        : (schueler?.subjects || []).map((f) => ({ ...LEER.bedarf[0], fach: f.subject, niveau: f.courseLevel || "" })),
    organisation: {
      ...LEER.organisation,
      ...(auskunft.organisation || {}),
      ort: schueler?.defaultLocationType || auskunft.organisation?.ort || "",
      adresse: schueler?.locationAddress || auskunft.organisation?.adresse || "",
    },
  };
}

export default function AkteBearbeiten({ studentId, onFertig, onAbbrechen }) {
  const [start, setStart] = useState(null);
  const [fehler, setFehler] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let aktiv = true;
    (async () => {
      try {
        const res = await fetch("/api/konto/daten", { cache: "no-store" });
        const daten = await res.json();
        if (!aktiv) return;
        if (!res.ok) {
          setFehler(daten.error || "Die Angaben ließen sich nicht laden.");
          return;
        }
        const schueler = studentId ? daten.schueler.find((s) => s._id === studentId) : null;
        setStart(ausAkte(daten.kunde, schueler));
      } catch {
        if (aktiv) setFehler("Keine Verbindung zum Server.");
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [studentId]);

  async function senden(werte) {
    setBusy(true);
    setFehler("");
    try {
      const res = await fetch("/api/konto/daten", {
        method: studentId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...werte, studentId }),
      });
      const antwort = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFehler(antwort.error || "Das hat nicht geklappt.");
        return;
      }
      onFertig(studentId ? "Angaben gespeichert." : "Schülerakte angelegt.");
    } catch {
      setFehler("Keine Verbindung zum Server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-[2rem] font-semibold text-tinte">
        {studentId ? "Angaben ändern" : "Weiteres Kind anlegen"}
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        {studentId
          ? "Was hier steht, steht auch in meiner Akte. Nach einer Änderung schaue ich noch einmal drüber."
          : "Ihre Angaben sind schon ausgefüllt – es fehlt nur noch das Kind."}
      </p>

      {fehler ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {fehler}
        </p>
      ) : null}

      {start ? (
        <SelbstauskunftFormular
          start={start}
          emailGesperrt
          busy={busy}
          absendeText={studentId ? "Änderungen speichern" : "Kind anlegen"}
          onSenden={senden}
          onAbbrechen={onAbbrechen}
        />
      ) : (
        <div className="h-40" aria-busy="true" />
      )}
    </div>
  );
}
