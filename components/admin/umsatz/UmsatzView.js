"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import {
  FAECHER,
  STATUS,
  WOCHEN_JE_MONAT,
  ZAHLUNGSARTEN,
  betragCent,
  hochrechnung,
  monatVerschieben,
  monatVon,
  monatsName,
} from "@/lib/umsatz/berechnung";
import {
  Badge,
  Button,
  Card,
  CardHead,
  Modal,
  Stat,
  centsToInput,
  errorText,
  formatDate,
  formatPrice,
  input,
  inputToCents,
  label as labelClass,
  plural,
  todayIso,
  useDialogs,
} from "@/components/admin/ui";

// Der Umsatzrechner. Zwei Arten von Zeilen: eigene Einträge, die ich hier
// anlege (Offenes, Geplantes, was sonst nirgends steht), und die Einnahmen
// aus dem Journal, die von selbst dazukommen – Rechnung bezahlt, Barzahlung,
// Storno. Journalzeilen sind hier gesperrt: Das Journal ist unveränderlich,
// Korrekturen laufen dort per Gegenbuchung. Siehe lib/umsatz/berechnung.js.

const STATUS_TON = { bezahlt: "emerald", offen: "amber", geplant: "slate" };
const ZAHLUNGSART_TEXT = Object.fromEntries(ZAHLUNGSARTEN);

function leereZeile(heute) {
  return {
    datum: heute,
    schuelerName: "",
    schuelerId: "",
    fach: "Mathematik",
    anzahl: "1",
    dauerMin: "45",
    preis: "",
    status: "bezahlt",
    zahlungsart: "ueberweisung",
    notiz: "",
  };
}

export default function UmsatzView() {
  const { adminFetch, notify } = useAdmin();
  const { confirm } = useDialogs();
  const heute = todayIso();

  const [monat, setMonat] = useState(monatVon(heute));
  const [daten, setDaten] = useState(null);
  const [schuelerListe, setSchuelerListe] = useState([]);
  const [zeile, setZeile] = useState(() => leereZeile(heute));
  const [speichert, setSpeichert] = useState(false);
  const [bearbeiten, setBearbeiten] = useState(null);

  const laden = useCallback(async () => {
    try {
      const d = await adminFetch(`/api/admin/umsatz?monat=${monat}`);
      setDaten(d);
    } catch (err) {
      notify(errorText(err));
    }
  }, [adminFetch, monat, notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      try {
        const s = await adminFetch("/api/admin/students");
        if (!abgebrochen) setSchuelerListe(s.students || []);
      } catch {
        // Die Namensliste ist nur eine Bequemlichkeit – Freitext geht immer.
      }
    })();
    return () => {
      abgebrochen = true;
    };
  }, [adminFetch]);

  const zeilenBetrag = useMemo(
    () => betragCent({ anzahl: Number.parseInt(zeile.anzahl, 10) || 0, preisCent: inputToCents(zeile.preis) || 0 }),
    [zeile.anzahl, zeile.preis]
  );

  // Zuletzt genutzter Preis für diese:n Schüler:in vorbelegen.
  async function schuelerGewaehlt(name) {
    const treffer = schuelerListe.find((s) => s.name === name);
    setZeile((z) => ({ ...z, schuelerName: name, schuelerId: treffer?._id || "" }));
    if (!name.trim()) return;
    try {
      const { preisCent } = await adminFetch("/api/admin/umsatz", {
        method: "PUT",
        body: JSON.stringify({ schuelerName: name }),
      });
      if (preisCent != null) setZeile((z) => (z.schuelerName === name ? { ...z, preis: centsToInput(preisCent) } : z));
    } catch {
      // Ohne Vorbelegung tippt man den Preis eben selbst.
    }
  }

  async function hinzufuegen(e) {
    e.preventDefault();
    setSpeichert(true);
    try {
      await adminFetch("/api/admin/umsatz", {
        method: "POST",
        body: JSON.stringify({
          datum: zeile.datum,
          schuelerName: zeile.schuelerName,
          schuelerId: zeile.schuelerId || null,
          fach: zeile.fach,
          anzahl: Number.parseInt(zeile.anzahl, 10),
          dauerMin: Number.parseInt(zeile.dauerMin, 10),
          preisCent: inputToCents(zeile.preis),
          status: zeile.status,
          zahlungsart: zeile.zahlungsart,
          notiz: zeile.notiz,
        }),
      });
      // Datum, Dauer und Zahlungsart bleiben stehen – beim Nachtragen
      // mehrerer Stunden ist das der Normalfall.
      setZeile((z) => ({ ...leereZeile(heute), datum: z.datum, dauerMin: z.dauerMin, zahlungsart: z.zahlungsart }));
      // Liegt der Eintrag in einem anderen Monat, dorthin wechseln –
      // sonst verschwindet er scheinbar spurlos.
      const ziel = monatVon(zeile.datum);
      if (ziel !== monat) setMonat(ziel);
      else await laden();
      notify("Eintrag hinzugefügt.");
    } catch (err) {
      notify(errorText(err));
    } finally {
      setSpeichert(false);
    }
  }

  async function loeschen(eintrag) {
    const ok = await confirm({
      title: "Eintrag löschen?",
      message: `${formatDate(eintrag.datum)} · ${eintrag.schuelerName} · ${formatPrice(betragCent(eintrag))}. Das lässt sich nicht rückgängig machen.`,
      danger: true,
      confirmLabel: "Ja, löschen",
    });
    if (!ok) return;
    try {
      await adminFetch(`/api/admin/umsatz/${eintrag._id}`, { method: "DELETE" });
      notify("Eintrag gelöscht.");
      await laden();
    } catch (err) {
      notify(errorText(err));
    }
  }

  const z = daten?.zahlen;

  return (
    <div className="space-y-5">
      {/* Monatswahl */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button onClick={() => setMonat((m) => monatVerschieben(m, -1))} aria-label="Vorheriger Monat">
            ◀
          </Button>
          <span className="min-w-44 text-center text-lg font-semibold tracking-[-0.3px]">{monatsName(monat)}</span>
          <Button onClick={() => setMonat((m) => monatVerschieben(m, 1))} aria-label="Nächster Monat">
            ▶
          </Button>
          {monat !== monatVon(heute) ? (
            <Button variant="ghost" onClick={() => setMonat(monatVon(heute))}>
              Heute
            </Button>
          ) : null}
        </div>
        <a
          href={`/api/admin/umsatz/export?monat=${monat}`}
          className="rounded-full bg-[var(--ck-surface2)] px-4.5 py-2.5 text-sm font-semibold transition hover:bg-[var(--ck-surface3)]"
        >
          Monat als CSV
        </a>
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat title="Umsatz gesamt" value={formatPrice(z?.umsatzCent || 0)} hint="bezahlt + offen" />
        <Stat title="davon bezahlt" value={formatPrice(z?.bezahltCent || 0)} tone="emerald" />
        <Stat title="davon offen" value={formatPrice(z?.offenCent || 0)} tone={z?.offenCent ? "amber" : "slate"} />
        <Stat
          title="Einheiten"
          value={z?.einheiten ?? 0}
          hint={`${(z?.stunden ?? 0).toLocaleString("de-DE")} Zeitstunden`}
        />
        <Stat title="Schnitt je Einheit" value={formatPrice(z?.schnittCent || 0)} />
        <Stat
          title="ggü. Vormonat"
          value={vergleichsText(z)}
          hint={z ? `${monatsName(z.vormonat)}: ${formatPrice(z.vormonatCent)}` : ""}
          tone={!z || z.deltaCent === 0 ? "slate" : z.deltaCent > 0 ? "emerald" : "red"}
        />
      </div>

      {/* Schnellerfassung */}
      <Card span={12}>
        <CardHead title="Schnellerfassung" />
        <p className="-mt-1 mb-3 text-[13px] text-[var(--ck-muted)]">
          Zahlungen aus dem Journal stehen unten von selbst – hier trägst du ein, was dort nicht steht: Offenes, Geplantes,
          Einnahmen ohne Buchung. Dieselbe Zahlung nicht zusätzlich eintragen, sie zählte sonst doppelt.
        </p>
        <form onSubmit={hinzufuegen}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[9.5rem_1fr_9rem_5rem_6rem_7rem_8rem_9rem]">
            <Feld text="Datum">
              <input type="date" required className={input} value={zeile.datum} onChange={(e) => setZeile((s) => ({ ...s, datum: e.target.value }))} />
            </Feld>
            <Feld text="Schüler:in">
              <input
                required
                list="umsatz-schueler"
                className={input}
                value={zeile.schuelerName}
                onChange={(e) => schuelerGewaehlt(e.target.value)}
                placeholder="Name oder frei eintippen"
              />
              <datalist id="umsatz-schueler">
                {schuelerListe.map((s) => (
                  <option key={s._id} value={s.name} />
                ))}
              </datalist>
            </Feld>
            <Feld text="Fach">
              <select className={input} value={zeile.fach} onChange={(e) => setZeile((s) => ({ ...s, fach: e.target.value }))}>
                {FAECHER.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Feld>
            <Feld text="Anzahl">
              <input
                type="number"
                min="1"
                max="100"
                required
                className={input}
                value={zeile.anzahl}
                onChange={(e) => setZeile((s) => ({ ...s, anzahl: e.target.value }))}
              />
            </Feld>
            <Feld text="Dauer (Min)">
              <input
                type="number"
                min="1"
                max="600"
                required
                className={input}
                value={zeile.dauerMin}
                onChange={(e) => setZeile((s) => ({ ...s, dauerMin: e.target.value }))}
              />
            </Feld>
            <Feld text="Preis je Einheit">
              <input
                inputMode="decimal"
                required
                className={input}
                value={zeile.preis}
                onChange={(e) => setZeile((s) => ({ ...s, preis: e.target.value }))}
                placeholder="15,00"
              />
            </Feld>
            <Feld text="Status">
              <select className={input} value={zeile.status} onChange={(e) => setZeile((s) => ({ ...s, status: e.target.value }))}>
                {STATUS.map(([key, text]) => (
                  <option key={key} value={key}>
                    {text}
                  </option>
                ))}
              </select>
            </Feld>
            <Feld text="Zahlungsart">
              <select className={input} value={zeile.zahlungsart} onChange={(e) => setZeile((s) => ({ ...s, zahlungsart: e.target.value }))}>
                {ZAHLUNGSARTEN.map(([key, text]) => (
                  <option key={key} value={key}>
                    {text}
                  </option>
                ))}
              </select>
            </Feld>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <Feld text="Notiz (optional)">
              <input className={input} value={zeile.notiz} onChange={(e) => setZeile((s) => ({ ...s, notiz: e.target.value }))} maxLength={300} />
            </Feld>
            <div className="rounded-[14px] bg-[var(--ck-surface2)] px-4 py-2.5 text-right">
              <span className="block text-xs text-[var(--ck-muted)]">Betrag</span>
              <span className="text-lg font-semibold tabular-nums">{formatPrice(zeilenBetrag)}</span>
            </div>
            <Button type="submit" variant="primary" busy={speichert} busyLabel="Wird gespeichert …">
              Eintrag hinzufügen
            </Button>
          </div>
        </form>
      </Card>

      {/* Liste */}
      <Card span={12}>
        <CardHead title={`Einträge · ${monatsName(monat)}`}>
          <span className="text-[13px] text-[var(--ck-muted)]">{plural(daten?.eintraege?.length || 0, "Eintrag", "Einträge")}</span>
        </CardHead>
        {!daten ? (
          <p className="py-6 text-center text-sm text-[var(--ck-muted)]">Lädt …</p>
        ) : daten.eintraege.length === 0 ? (
          <p className="rounded-[18px] border border-dashed border-[var(--ck-line)] p-8 text-center text-sm text-[var(--ck-muted)]">
            Für {monatsName(monat)} ist noch nichts eingetragen.
          </p>
        ) : (
          <ul>
            {daten.eintraege.map((e) => (
              <li
                key={e._id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--ck-line)] py-3 first:border-t-0"
              >
                <span className="min-w-40 flex-1">
                  <span className="block truncate text-[15px] font-semibold">
                    {e.schuelerName} <span className="font-normal text-[var(--ck-muted)]">· {e.fach}</span>
                  </span>
                  <span className="block truncate text-[13px] text-[var(--ck-muted)]">
                    {formatDate(e.datum)} ·{" "}
                    {e.anzahl !== 0 ? `${e.anzahl} × ${e.dauerMin} Min zu ${formatPrice(e.preisCent)}` : e.beschreibung || "Einnahme"} ·{" "}
                    {ZAHLUNGSART_TEXT[e.zahlungsart] || e.zahlungsart}
                    {e.notiz ? ` · ${e.notiz}` : ""}
                  </span>
                </span>
                {e.quelle === "journal" ? <Badge tone="indigo">Journal</Badge> : null}
                <Badge tone={STATUS_TON[e.status]}>{e.status}</Badge>
                <span className={`w-24 shrink-0 text-right text-[15px] font-semibold tabular-nums ${betragCent(e) < 0 ? "text-[var(--ck-neg)]" : ""}`}>
                  {formatPrice(betragCent(e))}
                </span>
                <span className="ml-auto flex shrink-0 gap-1">
                  {e.quelle === "journal" ? (
                    <Link
                      href="/admin/finanzen?ansicht=journal"
                      title="Journaleinträge sind unveränderlich – Korrekturen dort per Gegenbuchung"
                      className="rounded-full px-3 py-1.5 text-sm font-semibold text-[var(--ck-muted)] transition hover:bg-[var(--ck-surface2)] hover:text-[var(--ck-text)]"
                    >
                      Im Journal
                    </Link>
                  ) : (
                    <>
                      <Button variant="ghost" onClick={() => setBearbeiten(e)}>
                        Bearbeiten
                      </Button>
                      <Button variant="ghost" onClick={() => loeschen(e)} className="text-[var(--ck-neg)]">
                        Löschen
                      </Button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Aufschlüsselung, Hochrechnung, Planer */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-12">
        <Card span={4}>
          <CardHead title="Nach Schüler:in" />
          <Aufstellung zeilen={daten?.nachSchueler} einheit="Einheiten" />
        </Card>
        <Card span={4}>
          <CardHead title="Nach Fach" />
          <Aufstellung zeilen={daten?.nachFach} einheit="Einheiten" />
        </Card>
        <Card span={4}>
          <CardHead title="Hochrechnung" />
          <p className="text-[13px] text-[var(--ck-muted)]">
            Umsatz bis heute plus das, was als „geplant“ eingetragen ist.
          </p>
          <div className="mt-3 space-y-2">
            <ZeileWert text="Ist-Umsatz" wert={formatPrice(z?.umsatzCent || 0)} />
            <ZeileWert text="geplant" wert={formatPrice(z?.geplantCent || 0)} gedaempft />
            <div className="border-t border-[var(--ck-line)] pt-2">
              <ZeileWert text="Prognose Monat" wert={formatPrice(z?.prognoseCent || 0)} stark />
            </div>
          </div>
        </Card>
        <Card span={12}>
          <CardHead title="Was wäre wenn" />
          <Planer />
        </Card>
      </div>

      <p className="rounded-[18px] border border-[var(--ck-line)] bg-[var(--ck-surface)] p-4 text-[13px] leading-relaxed text-[var(--ck-muted)]">
        <b className="text-[var(--ck-text)]">So hängen Journal und Rechner zusammen.</b> Jede Einnahme im Journal erscheint hier
        von selbst, mit dem Datum der Zahlung – eine bezahlte Rechnung, eine Barzahlung, ein Storno (negativ). Stunden und
        Rechnungen allein ändern nichts, erst das Geld. Eigene Einträge ergänzen das um Offenes und Geplantes. Das Journal
        bleibt die steuerlich maßgebliche Aufzeichnung; die Summe hier kann davon abweichen, sobald du selbst etwas
        einträgst.
      </p>

      {bearbeiten ? (
        <BearbeitenDialog
          eintrag={bearbeiten}
          onClose={() => setBearbeiten(null)}
          onSaved={async () => {
            setBearbeiten(null);
            notify("Eintrag geändert.");
            await laden();
          }}
        />
      ) : null}
    </div>
  );
}

function vergleichsText(z) {
  if (!z) return "–";
  const zeichen = z.deltaCent > 0 ? "▲ " : z.deltaCent < 0 ? "▼ " : "";
  const prozent = z.deltaProzent == null ? "" : ` (${z.deltaProzent.toLocaleString("de-DE")} %)`;
  return `${zeichen}${formatPrice(Math.abs(z.deltaCent))}${prozent}`;
}

function Feld({ text, children }) {
  return (
    <label className="block min-w-0">
      <span className={labelClass}>{text}</span>
      {children}
    </label>
  );
}

function ZeileWert({ text, wert, stark = false, gedaempft = false }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`text-sm ${gedaempft ? "text-[var(--ck-muted)]" : ""}`}>{text}</span>
      <span className={`tabular-nums ${stark ? "text-lg font-semibold" : "font-semibold"} ${gedaempft ? "text-[var(--ck-muted)]" : ""}`}>
        {wert}
      </span>
    </div>
  );
}

function Aufstellung({ zeilen, einheit }) {
  if (!zeilen) return <p className="py-3 text-sm text-[var(--ck-muted)]">Lädt …</p>;
  if (zeilen.length === 0) return <p className="py-3 text-sm text-[var(--ck-muted)]">Noch nichts eingetragen.</p>;
  const groesster = zeilen[0].betragCent || 1;
  return (
    <ul className="space-y-2.5">
      {zeilen.map((r) => (
        <li key={r.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{r.name}</span>
            <span className="shrink-0 tabular-nums font-semibold">{formatPrice(r.betragCent)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--ck-surface2)]">
            <i className="block h-full bg-[var(--ck-accent)]" style={{ width: `${(r.betragCent / groesster) * 100}%` }} />
          </div>
          <span className="mt-0.5 block text-xs text-[var(--ck-muted)]">
            {r.einheiten} {einheit}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Reine Überschlagsrechnung – nichts davon wird gespeichert.
function Planer() {
  const [werte, setWerte] = useState({ schueler: "8", proWoche: "1", preis: "15,00" });
  const ergebnis = hochrechnung({
    schueler: Number.parseFloat(werte.schueler.replace(",", ".")) || 0,
    einheitenProWoche: Number.parseFloat(werte.proWoche.replace(",", ".")) || 0,
    preisCent: inputToCents(werte.preis) || 0,
  });
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
      <Feld text="Schüler:innen">
        <input inputMode="decimal" className={input} value={werte.schueler} onChange={(e) => setWerte((w) => ({ ...w, schueler: e.target.value }))} />
      </Feld>
      <Feld text="Einheiten je Woche und Person">
        <input inputMode="decimal" className={input} value={werte.proWoche} onChange={(e) => setWerte((w) => ({ ...w, proWoche: e.target.value }))} />
      </Feld>
      <Feld text="Preis je Einheit">
        <input inputMode="decimal" className={input} value={werte.preis} onChange={(e) => setWerte((w) => ({ ...w, preis: e.target.value }))} />
      </Feld>
      <div className="rounded-[18px] bg-[var(--ck-surface2)] px-5 py-3.5">
        <span className="block text-xs text-[var(--ck-muted)]">voraussichtlich je Monat</span>
        <span className="text-[26px] font-semibold tracking-[-0.8px] tabular-nums">{formatPrice(ergebnis.monatCent)}</span>
        <span className="mt-0.5 block text-xs text-[var(--ck-muted)]">
          {ergebnis.einheitenProMonat.toLocaleString("de-DE")} Einheiten · Faktor {WOCHEN_JE_MONAT.toLocaleString("de-DE")} Wochen je Monat ·{" "}
          {formatPrice(ergebnis.jahrCent)} im Jahr
        </span>
      </div>
    </div>
  );
}

function BearbeitenDialog({ eintrag, onClose, onSaved }) {
  const { adminFetch, notify } = useAdmin();
  const [form, setForm] = useState({
    datum: eintrag.datum,
    schuelerName: eintrag.schuelerName,
    fach: eintrag.fach,
    anzahl: String(eintrag.anzahl),
    dauerMin: String(eintrag.dauerMin),
    preis: centsToInput(eintrag.preisCent),
    status: eintrag.status,
    zahlungsart: eintrag.zahlungsart,
    notiz: eintrag.notiz || "",
  });
  const [speichert, setSpeichert] = useState(false);

  async function speichern(e) {
    e.preventDefault();
    setSpeichert(true);
    try {
      await adminFetch(`/api/admin/umsatz/${eintrag._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          datum: form.datum,
          schuelerName: form.schuelerName,
          fach: form.fach,
          anzahl: Number.parseInt(form.anzahl, 10),
          dauerMin: Number.parseInt(form.dauerMin, 10),
          preisCent: inputToCents(form.preis),
          status: form.status,
          zahlungsart: form.zahlungsart,
          notiz: form.notiz,
        }),
      });
      await onSaved();
    } catch (err) {
      notify(errorText(err));
      setSpeichert(false);
    }
  }

  return (
    <Modal title="Eintrag bearbeiten" onClose={onClose}>
      <form onSubmit={speichern} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Feld text="Datum">
            <input type="date" required className={input} value={form.datum} onChange={(e) => setForm((f) => ({ ...f, datum: e.target.value }))} />
          </Feld>
          <Feld text="Schüler:in">
            <input required className={input} value={form.schuelerName} onChange={(e) => setForm((f) => ({ ...f, schuelerName: e.target.value }))} />
          </Feld>
          <Feld text="Fach">
            <select className={input} value={form.fach} onChange={(e) => setForm((f) => ({ ...f, fach: e.target.value }))}>
              {[...new Set([...FAECHER, form.fach])].map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Feld>
          <Feld text="Status">
            <select className={input} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {STATUS.map(([key, text]) => (
                <option key={key} value={key}>
                  {text}
                </option>
              ))}
            </select>
          </Feld>
          <Feld text="Anzahl">
            <input type="number" min="1" max="100" required className={input} value={form.anzahl} onChange={(e) => setForm((f) => ({ ...f, anzahl: e.target.value }))} />
          </Feld>
          <Feld text="Dauer (Min)">
            <input type="number" min="1" max="600" required className={input} value={form.dauerMin} onChange={(e) => setForm((f) => ({ ...f, dauerMin: e.target.value }))} />
          </Feld>
          <Feld text="Preis je Einheit">
            <input inputMode="decimal" required className={input} value={form.preis} onChange={(e) => setForm((f) => ({ ...f, preis: e.target.value }))} />
          </Feld>
          <Feld text="Zahlungsart">
            <select className={input} value={form.zahlungsart} onChange={(e) => setForm((f) => ({ ...f, zahlungsart: e.target.value }))}>
              {ZAHLUNGSARTEN.map(([key, text]) => (
                <option key={key} value={key}>
                  {text}
                </option>
              ))}
            </select>
          </Feld>
        </div>
        <Feld text="Notiz">
          <input className={input} value={form.notiz} maxLength={300} onChange={(e) => setForm((f) => ({ ...f, notiz: e.target.value }))} />
        </Feld>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" variant="primary" busy={speichert}>
            Speichern
          </Button>
          <Button onClick={onClose}>Abbrechen</Button>
        </div>
      </form>
    </Modal>
  );
}
