"use client";

import { useMemo, useState } from "react";
import { AUSFALL_ARTEN, berechneAusfall, vorbereitungsSatzCent } from "@/lib/ausfall/berechnung";
import { prozentFuerArt } from "@/lib/ausfall/berechnung";
import { PREP_PERCENT, WAIT_MINUTES, CANCEL_FREE_HOURS } from "@/lib/legal/terms";
import { Button, Modal, errorText, formatPrice, input, label } from "@/components/admin/ui";

// Versäumten Termin mit Ausfallvergütung (§ 6 AGB) markieren. Die Vorbereitungs-
// zeit gibt man je Fall selbst an (Pflicht, keine Vorgabe); der Satz folgt der
// Klassenstufe und lässt sich überschreiben. Die Rechnung steht live darunter –
// dieselbe Rechnung wie später im Entwurf (lib/ausfall/berechnung.js).

export default function AusfallDialog({ lesson, adminFetch, notify, onClose, onSaved }) {
  const stundenpreisCent = lesson.ausfall?.stundenpreisCent ?? lesson.offerSnapshot?.priceCents ?? 0;
  const vorgabeSatz = vorbereitungsSatzCent(lesson.studentClass);
  const [art, setArt] = useState("no_show");
  const [minuten, setMinuten] = useState("");
  const [satz, setSatz] = useState(vorgabeSatz ? (vorgabeSatz / 100).toFixed(2).replace(".", ",") : "");
  const [absageAm, setAbsageAm] = useState("");
  const [kanal, setKanal] = useState("");
  const [wartezeit, setWartezeit] = useState(true);
  const [notiz, setNotiz] = useState("");
  const [busy, setBusy] = useState(false);

  const satzCent = useMemo(() => {
    const zahl = Number.parseFloat(String(satz).replace(",", "."));
    return Number.isFinite(zahl) ? Math.round(zahl * 100) : null;
  }, [satz]);

  const rechnung = useMemo(() => {
    try {
      return berechneAusfall({ art, stundenpreisCent, vorbereitungMin: Number(minuten), satzCent });
    } catch {
      return null;
    }
  }, [art, stundenpreisCent, minuten, satzCent]);

  async function speichern(event) {
    event.preventDefault();
    if (!rechnung) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/lessons/${lesson._id}/ausfall`, {
        method: "POST",
        body: JSON.stringify({
          art,
          vorbereitungMin: Number(minuten),
          satzCent,
          absageAm: absageAm.trim(),
          kanal: kanal.trim(),
          notiz: notiz.trim(),
          wartezeitEingehalten: wartezeit,
        }),
      });
      notify("Ausfallvergütung vermerkt – sie ist jetzt abrechenbar.");
      await onSaved();
    } catch (err) {
      notify(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Termin versäumt – Ausfallvergütung" onClose={onClose}>
      <form onSubmit={speichern} className="space-y-4 text-sm">
        <p className="text-[var(--ck-muted)]">
          Nach § 6 AGB wird {art === "late_cancel" ? "bei später Absage (nach Ablauf der kostenfreien Frist von " + CANCEL_FREE_HOURS + " Std.)" : "bei Nichterscheinen"} {prozentFuerArt(art)} % des Stundenpreises berechnet, zusätzlich {PREP_PERCENT} % der
          Vorbereitungszeit. Die Vorbereitungskosten gehören immer dazu.
        </p>

        <label className="block">
          <span className={label}>Was ist passiert?</span>
          <select className={input} value={art} onChange={(e) => setArt(e.target.value)}>
            {Object.entries(AUSFALL_ARTEN).map(([key, text]) => (
              <option key={key} value={key}>
                {text}
              </option>
            ))}
          </select>
        </label>

        {art === "late_cancel" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Absage erhalten am (Datum, Uhrzeit)</span>
              <input className={input} value={absageAm} onChange={(e) => setAbsageAm(e.target.value)} placeholder="z. B. 04.10.2026, 18:30" />
            </label>
            <label className="block">
              <span className={label}>Kanal</span>
              <input className={input} value={kanal} onChange={(e) => setKanal(e.target.value)} placeholder="E-Mail, Messenger, Anruf …" />
            </label>
          </div>
        ) : (
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={wartezeit} onChange={(e) => setWartezeit(e.target.checked)} className="mt-1" />
            <span>Ich habe {WAIT_MINUTES} Minuten gewartet, bevor der Termin als nicht wahrgenommen galt.</span>
          </label>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Vorbereitungszeit insgesamt (Minuten) *</span>
            <input className={input} inputMode="numeric" required value={minuten} onChange={(e) => setMinuten(e.target.value.replace(/\D/g, ""))} placeholder="z. B. 60" />
          </label>
          <label className="block">
            <span className={label}>Satz je Stunde Vorbereitung (€)</span>
            <input className={input} inputMode="decimal" required value={satz} onChange={(e) => setSatz(e.target.value)} />
            <span className="mt-1 block text-xs text-[var(--ck-faint)]">
              {vorgabeSatz
                ? `Klasse ${lesson.studentClass}: ${formatPrice(vorgabeSatz)} pro Stunde (bis Klasse 9: 15 €, ab Klasse 10: 25 €).`
                : "Die Klasse ist nicht lesbar – bitte den Satz selbst eintragen."}
            </span>
          </label>
        </div>

        <label className="block">
          <span className={label}>Notiz fürs Protokoll (optional, z. B. Kulanzgrund)</span>
          <input className={input} value={notiz} onChange={(e) => setNotiz(e.target.value)} maxLength={500} />
        </label>

        <div className="rounded-[14px] bg-[var(--ck-surface2)] p-4">
          {rechnung ? (
            <>
              <div className="flex justify-between">
                <span>Ausfallvergütung ({rechnung.prozent} % von {formatPrice(rechnung.stundenpreisCent)})</span>
                <span className="tabular-nums">{formatPrice(rechnung.stundenCent)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>
                  Vorbereitung ({rechnung.prepProzent} % von {rechnung.vorbereitungMin} Min. à {formatPrice(rechnung.satzCent)}/h)
                </span>
                <span className="tabular-nums">{formatPrice(rechnung.vorbereitungCent)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-[var(--ck-line)] pt-2 font-bold">
                <span>Gesamt</span>
                <span className="tabular-nums">{formatPrice(rechnung.totalCent)}</span>
              </div>
            </>
          ) : (
            <span className="text-[var(--ck-muted)]">Bitte Vorbereitungszeit und Satz angeben – dann erscheint die Berechnung.</span>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={!rechnung || busy}>
            {busy ? "Speichert …" : "Ausfallvergütung vermerken"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
