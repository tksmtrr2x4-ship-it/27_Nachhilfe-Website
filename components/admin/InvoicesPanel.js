"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatDate, formatPrice } from "@/lib/format";
import { AUSFALL_KURZ } from "@/lib/ausfall/berechnung";
import { hatAusfallVerguetung } from "@/lib/lessons/rules";

// Rechnungsbereich im Admin. Alle Schritte sind manuell: Entwurf anlegen →
// prüfen/bearbeiten → PDF-Vorschau → "Ausstellen" (Nummer, PDF/A-3) →
// "Versenden" (Mail mit Vorschau) → "Bezahlt" (mit Datum). Storno erzeugt
// eine eigene Stornorechnung. PDFs werden immer per authentifiziertem Fetch
// (x-admin-pin) geladen und als Blob angezeigt – es gibt keinen öffentlichen
// PDF-Link.

const STATUS_LABEL = {
  draft: "Entwurf",
  issuing: "wird ausgestellt…",
  issued: "Ausgestellt",
  sent: "Versendet",
  paid: "Bezahlt",
  cancelled: "Storniert",
};

const FILTERS = [
  ["all", "Alle"],
  ["draft", "Entwürfe"],
  ["open", "Offen"],
  ["overdue", "Überfällig"],
  ["paid", "Bezahlt"],
  ["cancelled", "Storniert"],
];

const input = "mt-1 w-full rounded-lg border border-[var(--ck-line)] px-3 py-2 text-sm text-[var(--ck-text)]";
const label = "text-xs font-semibold text-[var(--ck-muted)]";
// whitespace-nowrap: auf dem Handy sollen Pill-Buttons als Ganzes in die
// nächste Zeile rutschen, nicht mitten in der Beschriftung umbrechen.
const btnPrimary = "whitespace-nowrap rounded-full bg-[var(--ck-accent)] px-4 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50";
const btnSecondary = "whitespace-nowrap rounded-full border border-[var(--ck-line)] px-4 py-2 text-sm font-semibold text-[var(--ck-text)] hover:bg-[var(--ck-surface2)] disabled:opacity-50";
const link = "text-sm text-[var(--ck-muted)] hover:text-[var(--ck-accent)]";

function centsToEuroInput(cents) {
  return cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

function statusBadge(inv) {
  if (inv.overdue) return "bg-[var(--ck-neg-soft)] text-[var(--ck-neg)]";
  switch (inv.status) {
    case "draft":
      return "bg-[var(--ck-surface2)] text-[var(--ck-text)]";
    case "issued":
      return "bg-[var(--ck-warn-soft)] text-[var(--ck-warn)]";
    case "sent":
      return "bg-[var(--ck-accent-soft)] text-[var(--ck-accent)]";
    case "paid":
      return "bg-[var(--ck-pos-soft)] text-[var(--ck-pos)]";
    case "cancelled":
      return "bg-[var(--ck-surface2)] text-[var(--ck-muted)] line-through";
    default:
      return "bg-[var(--ck-surface2)] text-[var(--ck-text)]";
  }
}

export default function InvoicesPanel({ adminFetch, pin, setNotice, openInvoiceId, onOpened, onBookingsChanged, initialView, onBackFromCustomers }) {
  // Wird der Bereich als eigener Reiter geöffnet (Finanzen →
  // Rechnungsempfänger), startet er direkt dort.
  const [view, setView] = useState(initialView || "list");
  const [invoices, setInvoices] = useState([]);
  const [offen, setOffen] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [config, setConfig] = useState(null);
  const [filter, setFilter] = useState("all");
  const [current, setCurrent] = useState(null); // { invoice, customer, problems }
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(null); // Rechnung im Zahlungsdialog

  const refresh = useCallback(async () => {
    try {
      const [i, c, cfg] = await Promise.all([
        adminFetch("/api/admin/invoices"),
        adminFetch("/api/admin/customers"),
        adminFetch("/api/admin/invoices/config"),
      ]);
      setInvoices(i.invoices);
      setOffen(i.offen || []);
      const b = i.bereinigt;
      if (b && (b.geloescht || b.angepasst)) {
        setNotice(
          [
            b.geloescht ? `${b.geloescht === 1 ? "1 Rechnungsentwurf" : `${b.geloescht} Rechnungsentwürfe`} entfernt` : "",
            b.angepasst ? `${b.angepasst === 1 ? "1 Entwurf" : `${b.angepasst} Entwürfe`} angepasst` : "",
          ]
            .filter(Boolean)
            .join(", ") + " – die Stunden darin sind inzwischen bezahlt, abgesagt oder gelöscht.",
        );
      }
      setCustomers(c.customers);
      setConfig(cfg);
    } catch (err) {
      setNotice(err.message);
    }
  }, [adminFetch, setNotice]);

  // Initiales Laden beim Öffnen des Tabs – derselbe Lade-im-Effekt-Ansatz
  // wie refreshAll() in app/admin/page.js; die Daten kommen erst nach dem
  // await zurück, es gibt also keinen synchronen Render-Kaskadeneffekt.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const openEditor = useCallback(
    async (id) => {
      try {
        const data = await adminFetch(`/api/admin/invoices/${id}`);
        setCurrent(data);
        setView(data.invoice.status === "draft" ? "editor" : "detail");
      } catch (err) {
        setNotice(err.message);
      }
    },
    [adminFetch, setNotice]
  );

  // Versanddialog für eine ausgestellte Rechnung öffnen (Vorschau, dann
  // „Jetzt senden“).
  const openSend = useCallback(
    async (id) => {
      try {
        const data = await adminFetch(`/api/admin/invoices/${id}`);
        setCurrent(data);
        setView("send");
      } catch (err) {
        setNotice(err.message);
      }
    },
    [adminFetch, setNotice]
  );

  // Aus der Buchungsliste heraus geöffneter Entwurf.
  useEffect(() => {
    if (openInvoiceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      openEditor(openInvoiceId).then(() => onOpened?.());
    }
  }, [openInvoiceId, openEditor, onOpened]);

  async function fetchPdfBlobUrl(id) {
    const res = await fetch(`/api/admin/invoices/${id}/pdf`, { headers: { "x-admin-pin": pin } });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "PDF konnte nicht geladen werden.");
    }
    return URL.createObjectURL(await res.blob());
  }

  async function downloadCsv() {
    try {
      const res = await fetch("/api/admin/invoices/export", { headers: { "x-admin-pin": pin } });
      if (!res.ok) throw new Error("Export fehlgeschlagen.");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "rechnungen.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function createDraftForCustomer(customerId) {
    try {
      const data = await adminFetch("/api/admin/invoices", { method: "POST", body: JSON.stringify({ customerId }) });
      await refresh();
      openEditor(data.invoice._id);
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function issue(id) {
    if (!confirm("Rechnung jetzt ausstellen? Danach ist sie unveränderlich (Nummer wird vergeben).")) return;
    setBusy(true);
    try {
      const data = await adminFetch(`/api/admin/invoices/${id}/issue`, { method: "POST" });
      setNotice(`Rechnung ${data.invoice.number} ausgestellt – bitte jetzt Mailtext prüfen und versenden.`);
      await refresh();
      onBookingsChanged?.();
      // Direkt in den Versanddialog: Ausstellen allein verschickt nichts
      // (bewusst getrennt, damit die Mail vorher geprüft werden kann) – der
      // nächste Schritt soll aber nicht übersehen werden können.
      await openSend(id);
    } catch (err) {
      setNotice(err.problems?.length ? `${err.message} ${err.problems.join(" ")}` : err.message);
    } finally {
      setBusy(false);
    }
  }

  // Zahlungseingang mit Datum UND Zahlungsart (Überweisung, bar, Karte) –
  // wird automatisch als Einnahme im Buchhaltungs-Journal gebucht.
  function markPaid(inv) {
    setPaying(inv);
  }

  async function confirmPaid({ paidAt, method }) {
    const inv = paying;
    try {
      await adminFetch(`/api/admin/invoices/${inv._id}/paid`, { method: "POST", body: JSON.stringify({ paidAt, method }) });
      setNotice(`Rechnung ${inv.number} als bezahlt markiert und im Journal verbucht.`);
      setPaying(null);
      refresh();
      if (current?.invoice?._id === inv._id) openEditor(inv._id);
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function unmarkPaid(inv) {
    if (!confirm("Bezahlt-Markierung zurücknehmen?\n\nIm Buchhaltungs-Journal wird dafür eine Gegenbuchung erstellt.")) return;
    try {
      await adminFetch(`/api/admin/invoices/${inv._id}/paid`, { method: "DELETE" });
      refresh();
      if (current?.invoice?._id === inv._id) openEditor(inv._id);
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function cancelInvoice(inv) {
    if (!confirm(`Rechnung ${inv.number} stornieren? Es wird eine Stornorechnung mit eigener Nummer ausgestellt; die abgerechneten Stunden werden wieder frei.`)) return;
    setBusy(true);
    try {
      const data = await adminFetch(`/api/admin/invoices/${inv._id}/cancel`, { method: "POST" });
      setNotice(`Stornorechnung ${data.storno.number} ausgestellt – bitte jetzt versenden.`);
      await refresh();
      onBookingsChanged?.();
      await openSend(data.storno._id);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft(inv) {
    if (!confirm("Entwurf löschen?")) return;
    try {
      await adminFetch(`/api/admin/invoices/${inv._id}`, { method: "DELETE" });
      setNotice("Entwurf gelöscht.");
      setView("list");
      setCurrent(null);
      refresh();
    } catch (err) {
      setNotice(err.message);
    }
  }

  // Entwürfe zuerst (offene Arbeit, noch ohne Nummer), danach nach
  // Rechnungsdatum – das ist die Spalte, die in der Tabelle steht.
  const visible = invoices
    .filter((inv) => {
      if (filter === "all") return true;
      if (filter === "open") return ["issued", "sent"].includes(inv.status);
      if (filter === "overdue") return inv.overdue;
      return inv.status === filter;
    })
    .sort((a, b) => {
      const draftA = a.status === "draft" || a.status === "issuing";
      const draftB = b.status === "draft" || b.status === "issuing";
      if (draftA !== draftB) return draftA ? -1 : 1;
      if ((a.issueDate || "") !== (b.issueDate || "")) return (a.issueDate || "") < (b.issueDate || "") ? 1 : -1;
      return (a.number || "") < (b.number || "") ? 1 : -1;
    });

  return (
    <div className="mt-8 space-y-6">
      {paying && <PaymentDialog invoice={paying} onConfirm={confirmPaid} onClose={() => setPaying(null)} />}
      <ConfigBanner config={config} />

      {view === "list" && (
        <>
          <NochAbzurechnen gruppen={offen} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map(([key, text]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === key ? "bg-[var(--ck-accent)] text-black" : "bg-[var(--ck-surface2)] text-[var(--ck-text)] hover:bg-[var(--ck-surface3)]"}`}
                >
                  {text}
                  {key === "overdue" && invoices.some((i) => i.overdue) ? ` (${invoices.filter((i) => i.overdue).length})` : ""}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <NewInvoiceMenu customers={customers} onCreate={createDraftForCustomer} onNewCustomer={() => setView("customers")} />
              <button onClick={() => setView("customers")} className={btnSecondary}>
                Kund:innen
              </button>
              <button onClick={downloadCsv} className={btnSecondary}>
                CSV-Export
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-[var(--ck-muted)]">
                <tr className="border-b border-[var(--ck-line)]">
                  <th className="py-2 pr-4">Nummer</th>
                  <th className="py-2 pr-4">Datum</th>
                  <th className="py-2 pr-4">Empfänger:in</th>
                  <th className="py-2 pr-4 text-right">Betrag</th>
                  <th className="py-2 pr-4">Fällig</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((inv) => (
                  <tr key={inv._id} className={`border-b border-[var(--ck-line)] align-top ${inv.overdue ? "bg-[var(--ck-neg-soft)]" : ""}`}>
                    <td className="whitespace-nowrap py-2.5 pr-4 font-semibold text-[var(--ck-text)]">
                      {inv.number || <span className="font-normal text-[var(--ck-faint)]">Entwurf</span>}
                      {inv.type === "storno" && <span className="ml-1 rounded-full bg-[var(--ck-surface2)] px-2 py-0.5 text-xs font-normal text-[var(--ck-muted)]">Storno</span>}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-4">{inv.issueDate ? formatDate(inv.issueDate) : "–"}</td>
                    <td className="py-2.5 pr-4">
                      {inv.recipient?.name}
                      <br />
                      <span className="text-[var(--ck-muted)]">{inv.recipient?.email}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-right">{formatPrice(inv.totalCents || 0)}</td>
                    <td className="py-2.5 pr-4">{inv.dueDate && inv.type !== "storno" ? formatDate(inv.dueDate) : "–"}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(inv)}`}>
                        {inv.overdue ? "Überfällig" : STATUS_LABEL[inv.status] || inv.status}
                      </span>
                      {inv.sentCount > 0 ? (
                        <span className="ml-1 text-xs text-[var(--ck-muted)]">{inv.sentCount}× gesendet</span>
                      ) : inv.status === "issued" ? (
                        <span className="mt-1 block text-xs font-semibold text-[var(--ck-warn)]">noch nicht versendet</span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex flex-col items-start gap-1">
                        <button onClick={() => openEditor(inv._id)} className={link}>
                          {inv.status === "draft" ? "Bearbeiten" : "Details"}
                        </button>
                        {inv.status === "draft" && (
                          <button onClick={() => issue(inv._id)} disabled={busy} className="text-sm text-[var(--ck-pos)] hover:text-[var(--ck-pos)]">
                            Ausstellen
                          </button>
                        )}
                        {["issued", "sent", "paid", "cancelled"].includes(inv.status) && (
                          <button
                            onClick={() => openSend(inv._id)}
                            className={inv.sentCount > 0 ? link : "text-sm font-semibold text-[var(--ck-warn)] hover:text-[var(--ck-warn)]"}
                          >
                            {inv.sentCount > 0 ? "Erneut senden" : "Jetzt versenden"}
                          </button>
                        )}
                        {["issued", "sent"].includes(inv.status) && inv.type !== "storno" && (
                          <button onClick={() => markPaid(inv)} className="text-sm text-[var(--ck-pos)] hover:text-[var(--ck-pos)]">
                            Bezahlt
                          </button>
                        )}
                        {["issued", "sent", "paid"].includes(inv.status) && inv.type !== "storno" && (
                          <button onClick={() => cancelInvoice(inv)} disabled={busy} className="text-sm text-[var(--ck-neg)] hover:text-[var(--ck-neg)]">
                            Stornieren
                          </button>
                        )}
                        {inv.status === "draft" && (
                          <button onClick={() => deleteDraft(inv)} className="text-sm text-[var(--ck-neg)] hover:text-[var(--ck-neg)]">
                            Löschen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-[var(--ck-muted)]">
                      Keine Rechnungen in dieser Ansicht.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(view === "editor" || view === "detail") && current && (
        <InvoiceEditor
          data={current}
          adminFetch={adminFetch}
          setNotice={setNotice}
          fetchPdfBlobUrl={fetchPdfBlobUrl}
          busy={busy}
          onIssue={() => issue(current.invoice._id)}
          onSend={() => setView("send")}
          onPaid={() => markPaid(current.invoice)}
          onUnpaid={() => unmarkPaid(current.invoice)}
          onCancel={() => cancelInvoice(current.invoice)}
          onDelete={() => deleteDraft(current.invoice)}
          onReload={() => openEditor(current.invoice._id)}
          onBack={() => {
            setView("list");
            setCurrent(null);
            refresh();
          }}
        />
      )}

      {view === "send" && current && (
        <SendDialog
          invoice={current.invoice}
          adminFetch={adminFetch}
          setNotice={setNotice}
          fetchPdfBlobUrl={fetchPdfBlobUrl}
          onDone={() => {
            refresh();
            openEditor(current.invoice._id);
          }}
          onBack={() => openEditor(current.invoice._id)}
        />
      )}

      {view === "customers" && (
        <CustomersView
          customers={customers}
          adminFetch={adminFetch}
          setNotice={setNotice}
          onChanged={refresh}
          onCreateInvoice={createDraftForCustomer}
          onBack={onBackFromCustomers || (() => setView("list"))}
        />
      )}
    </div>
  );
}

function ConfigBanner({ config }) {
  if (!config) return null;
  const problems = [
    ...(config.missingEnv.length ? [`Fehlende Konfiguration (Server-Umgebungsvariablen): ${config.missingEnv.join(", ")}.`] : []),
    ...(config.storage?.ok ? [] : [`Speicherpfad nicht beschreibbar: ${config.storage?.path} (${config.storage?.error || ""}).`]),
    ...(config.mailConfigured ? [] : ["SMTP nicht konfiguriert – Rechnungen können ausgestellt, aber nicht per Mail versendet werden."]),
    // Sachstand, kein Konfigurationsfehler: Rechnungen lassen sich ausstellen
    // und versenden. Das eingebettete ZUGFeRD-XML erfüllt aber BR-E-02
    // (Steuerkategorie „Exempt" verlangt BT-31 oder BT-32) erst, sobald eine
    // echte Steuernummer hinterlegt ist.
    ...(config.taxNumberRejected
      ? [
          "In INVOICE_TAX_NUMBER steht eine elfstellige Zahl – das ist die persönliche Steuer-Identifikationsnummer und kommt nicht auf Rechnungen. Sie wird ignoriert. Bitte die Steuernummer vom Finanzamt eintragen (Form 12345/67890).",
        ]
      : []),
    ...(config.hasTaxRegistration
      ? []
      : [
          "Keine Steuernummer hinterlegt (INVOICE_TAX_NUMBER). Rechnungen funktionieren, das eingebettete E-Rechnungs-XML erfüllt die EN16931-Regel BR-E-02 aber erst mit einer vom Finanzamt vergebenen Steuernummer. Niemals die persönliche Steuer-Identifikationsnummer (11 Ziffern) eintragen.",
        ]),
  ];
  if (problems.length === 0) {
    return (
      <p className="text-xs text-[var(--ck-muted)]">
        Nummernformat {config.numberFormat} · Zahlungsziel {config.paymentTermDays} Tage · Ablage {config.storage?.path}
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-[var(--ck-warn)]/35 bg-[var(--ck-warn-soft)] p-4 text-sm text-[var(--ck-warn)]">
      <p className="font-semibold">Rechnungsstellung noch nicht vollständig eingerichtet</p>
      <ul className="mt-1 list-disc pl-5">
        {problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs">Siehe docs/rechnungen.md und .env.example.</p>
    </div>
  );
}

function NewInvoiceMenu({ customers, onCreate, onNewCustomer }) {
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={btnPrimary}>
        + Neue Rechnung
      </button>
    );
  }
  return (
    <div className="flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-[var(--ck-line)] p-2">
      <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="max-w-full rounded-lg border border-[var(--ck-line)] px-2 py-1.5 text-sm">
        <option value="">Kund:in wählen…</option>
        {customers.map((c) => (
          <option key={c._id} value={c._id}>
            {c.name || c.email} {c.studentName ? `(${c.studentName})` : ""}
          </option>
        ))}
      </select>
      <button
        disabled={!customerId}
        onClick={() => {
          onCreate(customerId);
          setOpen(false);
        }}
        className={btnPrimary}
      >
        Entwurf anlegen
      </button>
      <button onClick={onNewCustomer} className={link}>
        Neue:r Kund:in
      </button>
      <button onClick={() => setOpen(false)} className={link}>
        Abbrechen
      </button>
      <p className="w-full text-xs text-[var(--ck-muted)] sm:ml-2 sm:w-auto">Tipp: Direkt aus einer Buchung geht es über „Rechnung“ im Tab Buchungen.</p>
    </div>
  );
}

function InvoiceEditor({ data, adminFetch, setNotice, fetchPdfBlobUrl, busy, onIssue, onSend, onPaid, onUnpaid, onCancel, onDelete, onReload, onBack }) {
  const { invoice, customer } = data;
  const isDraft = invoice.status === "draft";
  const [recipient, setRecipient] = useState(invoice.recipient || {});
  const [studentName, setStudentName] = useState(invoice.studentName || "");
  const [subject, setSubject] = useState(invoice.subject || "");
  const [lines, setLines] = useState(
    (invoice.lines || []).map((l) => ({ ...l, unitPrice: centsToEuroInput(l.unitPriceCents), minutes: l.minutes ?? "" }))
  );
  const [saveToCustomer, setSaveToCustomer] = useState(true);
  const [problems, setProblems] = useState(data.problems || []);
  const [unbilled, setUnbilled] = useState([]);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!isDraft || !invoice.customerId) return;
    adminFetch(`/api/admin/invoices/unbilled?customerId=${invoice.customerId}`)
      .then((d) => setUnbilled(d.sessions.filter((s) => !lines.some((l) => l.bookingId === s._id))))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice._id]);

  useEffect(() => () => pdfUrl && URL.revokeObjectURL(pdfUrl), [pdfUrl]);

  function updateLine(index, field, value) {
    setDirty(true);
    // Wer den Einzelpreis ändert, ändert ihn wirklich: der gespeicherte
    // Cent-Wert ginge sonst beim Speichern vor (normalizeLine).
    const patch = field === "unitPrice" ? { unitPrice: value, unitPriceCents: undefined } : { [field]: value };
    setLines((ls) => ls.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine(fromSession) {
    setDirty(true);
    if (fromSession?.lines?.length) {
      // Fertige Positionen vom Server (bei versäumten Terminen die zwei
      // Ausfall-Positionen nach § 6 AGB).
      setLines((ls) => [
        ...ls,
        ...fromSession.lines.map((l) => ({ ...l, minutes: l.minutes ?? "", unitPrice: centsToEuroInput(l.unitPriceCents) })),
      ]);
      setUnbilled((u) => u.filter((s) => s._id !== fromSession._id));
    } else if (fromSession) {
      const snap = fromSession.offerSnapshot || {};
      setLines((ls) => [
        ...ls,
        {
          date: fromSession.requestedDate,
          description: `Nachhilfe ${fromSession.subject || ""}`.trim(),
          minutes: snap.durationMinutes || "",
          quantity: 1,
          unitPrice: centsToEuroInput(snap.priceCents || 0),
          bookingId: fromSession._id,
        },
      ]);
      setUnbilled((u) => u.filter((s) => s._id !== fromSession._id));
    } else {
      setLines((ls) => [...ls, { date: "", description: "Nachhilfe ", minutes: "", quantity: 1, unitPrice: "", bookingId: null }]);
    }
  }

  function removeLine(index) {
    setDirty(true);
    setLines((ls) => ls.filter((_, i) => i !== index));
  }

  function lineTotalCents(l) {
    const cents = Math.round(parseFloat(String(l.unitPrice || "0").replace(/\./g, "").replace(",", ".")) * 100) || 0;
    // Menge wie auf dem Server: ganze Zahl (lib/invoicing/validation.js).
    return (Number.parseInt(l.quantity, 10) || 0) * cents;
  }
  const total = lines.reduce((sum, l) => sum + lineTotalCents(l), 0);

  // Eingabefelder einer Position – identisch in Tabellen- (ab sm) und
  // Karten-Darstellung (Handy), nur mit anderer Breite.
  function lineInput(i, field, widthClass) {
    const l = lines[i];
    const value = field === "quantity" ? l.quantity ?? 1 : l[field] ?? "";
    return (
      <input
        type={field === "date" ? "date" : "text"}
        inputMode={field === "minutes" || field === "quantity" ? "numeric" : field === "unitPrice" ? "decimal" : undefined}
        value={value}
        disabled={!isDraft}
        onChange={(e) => updateLine(i, field, field === "quantity" || field === "minutes" ? e.target.value.replace(/\D/g, "") : e.target.value)}
        className={`${input} mt-0 ${widthClass}`}
      />
    );
  }
  function removeButton(i) {
    if (!isDraft) return null;
    return (
      <button onClick={() => removeLine(i)} className="text-xs text-[var(--ck-neg)]" title="Position entfernen">
        ✕ entfernen
      </button>
    );
  }

  async function save() {
    try {
      const res = await adminFetch(`/api/admin/invoices/${invoice._id}`, {
        method: "PATCH",
        body: JSON.stringify({ recipient, studentName, subject, lines, saveToCustomer }),
      });
      setProblems(res.problems || []);
      setDirty(false);
      setNotice("Entwurf gespeichert.");
      return true;
    } catch (err) {
      setNotice(err.message);
      return false;
    }
  }

  async function preview() {
    if (isDraft && dirty && !(await save())) return;
    try {
      setPdfUrl(await fetchPdfBlobUrl(invoice._id));
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function saveAndIssue() {
    if (dirty && !(await save())) return;
    onIssue();
  }

  const consent = invoice.eInvoiceConsent || customer?.eInvoiceConsent;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={onBack} className={link}>
            ← Zurück zur Übersicht
          </button>
          <h2 className="mt-1 text-xl font-semibold text-[var(--ck-text)]">
            {invoice.type === "storno" ? "Stornorechnung" : "Rechnung"} {invoice.number || "(Entwurf)"}
            <span className={`ml-2 align-middle rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(invoice)}`}>
              {invoice.overdue ? "Überfällig" : STATUS_LABEL[invoice.status]}
            </span>
          </h2>
          {!isDraft && (
            <p className="text-xs text-[var(--ck-muted)]">
              Ausgestellt am {formatDate(invoice.issueDate)}
              {invoice.dueDate && invoice.type !== "storno" ? ` · fällig ${formatDate(invoice.dueDate)}` : ""}
              {invoice.paidAt ? ` · bezahlt am ${formatDate(invoice.paidAt)}` : ""}
              {invoice.sentAt ? ` · versendet ${invoice.sentCount}× (zuletzt an ${invoice.sentTo})` : ""}
              {invoice.cancelsNumber ? ` · storniert ${invoice.cancelsNumber}` : ""}
              {invoice.pdf?.sha256 ? ` · SHA-256 ${invoice.pdf.sha256.slice(0, 12)}…` : ""}
              {invoice.retainUntil ? ` · Aufbewahrung bis ${formatDate(invoice.retainUntil)}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft ? (
            <>
              <button onClick={save} className={btnSecondary} disabled={!dirty}>
                Speichern
              </button>
              <button onClick={preview} className={btnSecondary}>
                PDF-Vorschau
              </button>
              <button onClick={saveAndIssue} className={btnPrimary} disabled={busy || problems.length > 0 && !dirty}>
                Rechnung ausstellen
              </button>
              <button onClick={onDelete} className="text-sm text-[var(--ck-neg)]">
                Entwurf löschen
              </button>
            </>
          ) : (
            <>
              <button onClick={preview} className={btnSecondary}>
                PDF anzeigen
              </button>
              {invoice.status !== "cancelled" && (
                <button onClick={onSend} className={btnPrimary}>
                  {invoice.sentCount > 0 ? "Erneut senden" : "Versenden"}
                </button>
              )}
              {["issued", "sent"].includes(invoice.status) && invoice.type !== "storno" && (
                <button onClick={onPaid} className={btnSecondary}>
                  Als bezahlt markieren
                </button>
              )}
              {invoice.status === "paid" && (
                <button onClick={onUnpaid} className={link}>
                  Bezahlt zurücknehmen
                </button>
              )}
              {["issued", "sent", "paid"].includes(invoice.status) && invoice.type !== "storno" && (
                <button onClick={onCancel} className="text-sm text-[var(--ck-neg)]" disabled={busy}>
                  Stornieren
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {!isDraft && invoice.status === "issued" && !invoice.sentCount && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--ck-warn)]/35 bg-[var(--ck-warn-soft)] p-4 text-sm text-[var(--ck-warn)]">
          <p>
            <span className="font-semibold">Noch nicht versendet.</span> Das Ausstellen vergibt Nummer und PDF – die
            Mail an {invoice.recipient?.email || "die Kundin/den Kunden"} geht erst mit „Versenden“ raus.
          </p>
          <button onClick={onSend} className={btnPrimary}>
            Jetzt versenden
          </button>
        </div>
      )}

      {isDraft && problems.length > 0 && (
        <div className="rounded-xl border border-[var(--ck-warn)]/35 bg-[var(--ck-warn-soft)] p-4 text-sm text-[var(--ck-warn)]">
          <p className="font-semibold">Vor dem Ausstellen fehlt noch:</p>
          <ul className="mt-1 list-disc pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {!consent?.given && (
        <div className="rounded-xl border border-[var(--ck-line)] bg-[var(--ck-surface2)] p-3 text-xs text-[var(--ck-muted)]">
          Für diese:n Kund:in ist keine Einwilligung in elektronische Rechnungen dokumentiert. Vor dem Mailversand wird gewarnt; manuell nachtragen unter „Kund:innen“.
        </div>
      )}

      {/* min-w-0 auf den Grid-Kindern ist entscheidend: Grid-Spuren sind
          minmax(auto, 1fr), ein Kind kann also nicht schmaler als sein
          Inhalt werden – die Positionstabelle dehnte dadurch auf dem Handy
          den ganzen Rahmen über das Display, statt intern zu scrollen. */}
      <div className="grid gap-6 lg:grid-cols-3">
        <fieldset className="min-w-0 rounded-2xl border border-[var(--ck-line)] p-4 lg:col-span-1" disabled={!isDraft}>
          <legend className="px-1 text-sm font-semibold text-[var(--ck-text)]">Rechnungsempfänger:in</legend>
          {[
            ["name", "Name (Vertragspartner:in, i.d.R. Elternteil)"],
            ["street", "Straße und Hausnummer"],
            ["zip", "PLZ"],
            ["city", "Ort"],
            ["country", "Land (ISO, z.B. DE)"],
            ["email", "E-Mail (für den Versand)"],
          ].map(([key, text]) => (
            <label key={key} className="mt-3 block">
              <span className={label}>{text}</span>
              <input
                value={recipient[key] || ""}
                onChange={(e) => {
                  setDirty(true);
                  setRecipient((r) => ({ ...r, [key]: e.target.value }));
                }}
                className={input}
              />
            </label>
          ))}
          {isDraft && (
            <label className="mt-3 flex items-center gap-2 text-xs text-[var(--ck-muted)]">
              <input type="checkbox" checked={saveToCustomer} onChange={(e) => setSaveToCustomer(e.target.checked)} className="h-4 w-4 rounded border-[var(--ck-line)]" />
              Adresse im Kundendatensatz speichern
            </label>
          )}
          <label className="mt-4 block">
            <span className={label}>Schüler:in (für die Mail)</span>
            <input value={studentName} onChange={(e) => { setDirty(true); setStudentName(e.target.value); }} className={input} />
          </label>
          <label className="mt-3 block">
            <span className={label}>Fach (für die Mail)</span>
            <input value={subject} onChange={(e) => { setDirty(true); setSubject(e.target.value); }} className={input} />
          </label>
        </fieldset>

        <div className="min-w-0 space-y-4 lg:col-span-2">
          {isDraft && unbilled.length > 0 && (
            <div className="rounded-2xl border border-[var(--ck-pos)]/35 bg-[var(--ck-pos-soft)] p-4">
              <p className="text-sm font-semibold text-[var(--ck-pos)]">Noch nicht abgerechnete Stunden</p>
              <ul className="mt-2 space-y-1 text-sm">
                {unbilled.map((s) => (
                  <li key={s._id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span>
                      {formatDate(s.requestedDate)} {s.requestedTime} Uhr · {s.subject} · {s.offerSnapshot?.durationLabel} · {formatPrice(s.offerSnapshot?.priceCents || 0)}
                      {hatAusfallVerguetung(s) ? (
                        <span className="ml-1 text-xs font-semibold text-[var(--ck-warn)]">({AUSFALL_KURZ[s.ausfall.art] || "Versäumt"} · Ausfallvergütung)</span>
                      ) : s.heldStatus !== "held" ? (
                        <span className="ml-1 text-xs text-[var(--ck-pos)]">(automatisch: Termin vergangen)</span>
                      ) : null}
                    </span>
                    <button onClick={() => addLine(s)} className="text-sm font-semibold text-[var(--ck-pos)] hover:underline">
                      + Hinzufügen
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="min-w-0 rounded-2xl border border-[var(--ck-line)] p-4">
            <p className="text-sm font-semibold text-[var(--ck-text)]">Positionen</p>

            {/* ab sm: kompakte Tabelle (scrollt bei Bedarf innerhalb des Rahmens) */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="mt-2 w-full text-sm">
                <thead className="text-left text-xs text-[var(--ck-muted)]">
                  <tr>
                    <th className="py-1 pr-2">Datum</th>
                    <th className="py-1 pr-2">Leistung</th>
                    <th className="py-1 pr-2">Min.</th>
                    <th className="py-1 pr-2">Menge</th>
                    <th className="py-1 pr-2">Einzelpreis €</th>
                    <th className="py-1 pr-2 text-right">Gesamt</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="align-top">
                      <td className="py-1 pr-2">{lineInput(i, "date", "w-36")}</td>
                      <td className="py-1 pr-2">{lineInput(i, "description", "min-w-44")}</td>
                      <td className="py-1 pr-2">{lineInput(i, "minutes", "w-16")}</td>
                      <td className="py-1 pr-2">{lineInput(i, "quantity", "w-16")}</td>
                      <td className="py-1 pr-2">{lineInput(i, "unitPrice", "w-24")}</td>
                      <td className="py-2 pr-2 text-right whitespace-nowrap">{formatPrice(lineTotalCents(l))}</td>
                      <td className="py-2">{removeButton(i)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* unter sm: eine Karte je Position – auf dem Handy ist eine
                7-spaltige Eingabetabelle nicht bedienbar */}
            <div className="mt-2 space-y-3 sm:hidden">
              {lines.map((l, i) => (
                <div key={i} className="rounded-xl border border-[var(--ck-line)] bg-[var(--ck-surface2)] p-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--ck-muted)]">
                    <span>Position {i + 1}</span>
                    {removeButton(i)}
                  </div>
                  <label className="mt-2 block">
                    <span className={label}>Leistung</span>
                    {lineInput(i, "description", "w-full")}
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className={label}>Datum</span>
                      {lineInput(i, "date", "w-full")}
                    </label>
                    <label className="block">
                      <span className={label}>Minuten</span>
                      {lineInput(i, "minutes", "w-full")}
                    </label>
                    <label className="block">
                      <span className={label}>Menge</span>
                      {lineInput(i, "quantity", "w-full")}
                    </label>
                    <label className="block">
                      <span className={label}>Einzelpreis €</span>
                      {lineInput(i, "unitPrice", "w-full")}
                    </label>
                  </div>
                  <p className="mt-2 text-right text-sm font-semibold text-[var(--ck-text)]">Gesamt {formatPrice(lineTotalCents(l))}</p>
                </div>
              ))}
              {lines.length === 0 && <p className="text-sm text-[var(--ck-muted)]">Noch keine Positionen.</p>}
            </div>

            {isDraft && (
              <button onClick={() => addLine(null)} className="mt-2 text-sm font-semibold text-[var(--ck-accent)]">
                + Freie Position
              </button>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--ck-line)] pt-3">
              <span className="text-xs text-[var(--ck-muted)]">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</span>
              <span className="text-base font-semibold text-[var(--ck-text)]">Gesamt {formatPrice(isDraft ? total : invoice.totalCents || 0)}</span>
            </div>
          </div>

          {invoice.sendLog?.length > 0 && (
            <div className="rounded-2xl border border-[var(--ck-line)] p-4 text-xs text-[var(--ck-muted)]">
              <p className="font-semibold text-[var(--ck-text)]">Versandprotokoll</p>
              <ul className="mt-1 space-y-0.5">
                {invoice.sendLog.map((e, i) => (
                  <li key={i}>
                    {new Date(e.at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} → {e.to} · {e.ok ? "zugestellt an SMTP" : `Fehler: ${e.error}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {pdfUrl && (
        <div className="rounded-2xl border border-[var(--ck-line)] p-2">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-sm font-semibold text-[var(--ck-text)]">{isDraft ? "Vorschau (Entwurf, ohne Nummer)" : invoice.pdf?.filename}</p>
            <div className="flex gap-3">
              <a href={pdfUrl} download={invoice.pdf?.filename || "Entwurf.pdf"} className={link}>
                Herunterladen
              </a>
              <button onClick={() => setPdfUrl(null)} className={link}>
                Schließen
              </button>
            </div>
          </div>
          <iframe title="Rechnungs-PDF" src={pdfUrl} className="h-[80vh] w-full rounded-xl border border-[var(--ck-line)]" />
        </div>
      )}
      <button onClick={onReload} className="hidden" aria-hidden="true" />
    </div>
  );
}

function SendDialog({ invoice, adminFetch, setNotice, fetchPdfBlobUrl, onDone, onBack }) {
  const [form, setForm] = useState(null);
  const [sending, setSending] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  useEffect(() => {
    adminFetch(`/api/admin/invoices/${invoice._id}/send`)
      .then(setForm)
      .catch((err) => setNotice(err.message));
  }, [adminFetch, invoice._id, setNotice]);

  useEffect(() => () => pdfUrl && URL.revokeObjectURL(pdfUrl), [pdfUrl]);

  async function send() {
    if (form.warnings?.length && !confirm(`Hinweise:\n- ${form.warnings.join("\n- ")}\n\nTrotzdem senden?`)) return;
    setSending(true);
    try {
      await adminFetch(`/api/admin/invoices/${invoice._id}/send`, {
        method: "POST",
        body: JSON.stringify({ to: form.to, subject: form.subject, text: form.text }),
      });
      setNotice(`Rechnung ${invoice.number} an ${form.to} versendet.`);
      onDone();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSending(false);
    }
  }

  if (!form) return <p className="text-sm text-[var(--ck-muted)]">Lade Vorschau…</p>;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className={link}>
        ← Zurück
      </button>
      <h2 className="text-xl font-semibold text-[var(--ck-text)]">
        {invoice.type === "storno" ? "Stornorechnung" : "Rechnung"} {invoice.number} versenden
      </h2>
      {!invoice.sentCount && (
        <p className="rounded-xl bg-[var(--ck-accent-soft)] p-3 text-sm text-[var(--ck-accent)]">
          Die Rechnung ist ausgestellt, aber noch nicht verschickt. Text bei Bedarf anpassen und unten auf
          <span className="font-semibold"> „Jetzt senden“</span> klicken – erst dann geht die Mail mit dem PDF raus.
        </p>
      )}
      {form.warnings?.length > 0 && (
        <div className="rounded-xl border border-[var(--ck-warn)]/35 bg-[var(--ck-warn-soft)] p-3 text-sm text-[var(--ck-warn)]">
          <ul className="list-disc pl-5">
            {form.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block">
            <span className={label}>An</span>
            <input value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} className={input} />
          </label>
          <label className="block">
            <span className={label}>Betreff</span>
            <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className={input} />
          </label>
          <label className="block">
            <span className={label}>Text</span>
            <textarea value={form.text} rows={18} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} className={`${input} font-mono text-xs`} />
          </label>
          <p className="text-xs text-[var(--ck-muted)]">Anhang: {form.attachment}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={send} disabled={sending} className={btnPrimary}>
              {sending ? "Wird gesendet…" : "Jetzt senden"}
            </button>
            <button
              onClick={async () => {
                try {
                  setPdfUrl(await fetchPdfBlobUrl(invoice._id));
                } catch (err) {
                  setNotice(err.message);
                }
              }}
              className={btnSecondary}
            >
              Anhang ansehen
            </button>
          </div>
        </div>
        {pdfUrl && <iframe title="Anhang" src={pdfUrl} className="h-[70vh] w-full rounded-xl border border-[var(--ck-line)]" />}
      </div>
    </div>
  );
}

function CustomersView({ customers, adminFetch, setNotice, onChanged, onCreateInvoice, onBack }) {
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  async function save(form) {
    try {
      if (form._id) {
        await adminFetch(`/api/admin/customers/${form._id}`, { method: "PATCH", body: JSON.stringify(form) });
      } else {
        await adminFetch("/api/admin/customers", { method: "POST", body: JSON.stringify(form) });
      }
      setEditing(null);
      setCreating(false);
      setNotice("Kundendaten gespeichert.");
      onChanged();
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function remove(c) {
    if (
      !confirm(
        `${c.name || c.email} wirklich löschen? Offene Rechnungsentwürfe dieser Person werden mitgelöscht. Ausgestellte Rechnungen bleiben erhalten – solange eine davon in der 8-jährigen Aufbewahrung liegt, ist das Löschen gesperrt.`
      )
    )
      return;
    try {
      const res = await adminFetch(`/api/admin/customers/${c._id}`, { method: "DELETE" });
      setNotice(
        res.draftsDeleted > 0
          ? `Kund:in gelöscht (${res.draftsDeleted} Entwurf/Entwürfe mit entfernt).`
          : "Kund:in gelöscht."
      );
      onChanged();
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function markConsent(c, given) {
    const note = given ? prompt("Wie wurde die Einwilligung erteilt? (z.B. „telefonisch am 12.09.2026“)", "") : null;
    if (given && note === null) return;
    try {
      await adminFetch(`/api/admin/customers/${c._id}`, {
        method: "PATCH",
        body: JSON.stringify({ eInvoiceConsent: given, eInvoiceConsentNote: note }),
      });
      onChanged();
    } catch (err) {
      setNotice(err.message);
    }
  }

  const form = editing || (creating ? { name: "", street: "", zip: "", city: "", country: "DE", email: "", phone: "", studentName: "" } : null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className={link}>
          ← Zurück zu den Rechnungen
        </button>
        <button onClick={() => setCreating(true)} className={btnPrimary}>
          + Neue:r Kund:in
        </button>
      </div>
      {form && (
        <CustomerForm
          initial={form}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={save}
        />
      )}
      <div className="space-y-2">
        {customers.map((c) => (
          <div key={c._id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--ck-line)] p-4 text-sm">
            <div>
              <p className="font-semibold text-[var(--ck-text)]">
                {c.name || <span className="text-[var(--ck-faint)]">(ohne Name)</span>}
                {c.studentName && <span className="font-normal text-[var(--ck-muted)]"> · Schüler:in {c.studentName}</span>}
              </p>
              <p className="text-[var(--ck-muted)]">
                {[c.street, `${c.zip || ""} ${c.city || ""}`.trim()].filter(Boolean).join(", ") || <span className="text-[var(--ck-warn)]">Anschrift fehlt</span>}
              </p>
              <p className="text-[var(--ck-muted)]">
                {c.email}
                {c.phone ? ` · ${c.phone}` : ""}
              </p>
              <p className="mt-1 text-xs">
                {c.eInvoiceConsent?.given ? (
                  <span className="text-[var(--ck-pos)]">
                    E-Rechnung: Einwilligung {c.eInvoiceConsent.source === "booking" ? "im Buchungsformular" : "manuell"} am{" "}
                    {new Date(c.eInvoiceConsent.at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}
                    {c.eInvoiceConsent.note ? ` (${c.eInvoiceConsent.note})` : ""}
                  </span>
                ) : (
                  <span className="text-[var(--ck-warn)]">E-Rechnung: keine Einwilligung dokumentiert</span>
                )}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button onClick={() => onCreateInvoice(c._id)} className="text-sm font-semibold text-[var(--ck-accent)]">
                Rechnung erstellen
              </button>
              <button onClick={() => setEditing({ ...c })} className={link}>
                Bearbeiten
              </button>
              {c.eInvoiceConsent?.given ? (
                <button onClick={() => markConsent(c, false)} className={link}>
                  Einwilligung entfernen
                </button>
              ) : (
                <button onClick={() => markConsent(c, true)} className="text-sm text-[var(--ck-pos)]">
                  Einwilligung dokumentieren
                </button>
              )}
              <button onClick={() => remove(c)} className="text-sm text-[var(--ck-neg)] hover:text-[var(--ck-neg)]">
                Löschen
              </button>
            </div>
          </div>
        ))}
        {customers.length === 0 && <p className="text-sm text-[var(--ck-muted)]">Noch keine Kund:innen – entstehen automatisch beim ersten „Rechnung“ aus einer Buchung.</p>}
      </div>
    </div>
  );
}

// Auch von der Schülerakte aus benutzt – dort steht die Anschrift, die für
// Rechnungen fehlt, und dort soll man sie auch ändern können.
export function CustomerForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(initial);
  const fields = [
    ["name", "Name"],
    ["email", "E-Mail"],
    ["street", "Straße und Hausnummer"],
    ["zip", "PLZ"],
    ["city", "Ort"],
    ["country", "Land"],
    ["phone", "Telefon"],
    ["studentName", "Schüler:in"],
  ];
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
      className="grid gap-3 rounded-2xl border border-[var(--ck-line)] p-4 sm:grid-cols-2"
    >
      {fields.map(([key, text]) => (
        <label key={key} className="block">
          <span className={label}>{text}</span>
          <input value={form[key] || ""} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className={input} required={key === "email"} />
        </label>
      ))}
      <div className="flex gap-3 sm:col-span-2">
        <button type="submit" className={btnPrimary}>
          Speichern
        </button>
        <button type="button" onClick={onCancel} className={link}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

const PAYMENT_METHODS = [
  ["bank", "Überweisung"],
  ["cash", "Bar"],
  ["card", "Karte"],
];

function PaymentDialog({ invoice, onConfirm, onClose }) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState("bank");
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Zahlungseingang erfassen">
      <div className="w-full max-w-md rounded-2xl bg-[var(--ck-surface)] p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-[var(--ck-text)]">Zahlungseingang {invoice.number}</h3>
        <p className="mt-1 text-sm text-[var(--ck-muted)]">{formatPrice(invoice.totalCents)} · {invoice.recipient?.name}</p>
        <div className="mt-4 grid gap-3">
          <label className="block">
            <span className={label}>Bezahlt am</span>
            <input type="date" className={input} value={paidAt} max={today} onChange={(e) => setPaidAt(e.target.value)} />
          </label>
          <fieldset>
            <legend className={label}>Zahlungsart</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {PAYMENT_METHODS.map(([key, text]) => (
                <label key={key} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${method === key ? "border-[var(--ck-accent)] bg-[var(--ck-accent-soft)] text-[var(--ck-accent)]" : "border-[var(--ck-line)] text-[var(--ck-text)]"}`}>
                  <input type="radio" name="method" value={key} checked={method === key} onChange={() => setMethod(key)} className="sr-only" />
                  {text}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-xs text-[var(--ck-muted)]">Die Einnahme wird automatisch im Buchhaltungs-Journal gebucht (Tab „Schüler &amp; Buchhaltung“).</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            className={btnPrimary}
            disabled={saving || !paidAt}
            onClick={async () => {
              setSaving(true);
              await onConfirm({ paidAt, method });
              setSaving(false);
            }}
          >
            Als bezahlt buchen
          </button>
          <button className={btnSecondary} onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

// Stunden, die noch nicht abgerechnet sind – auch wenn es dafür noch keinen
// Rechnungsentwurf gibt (lib/invoicing/offene.js). Ein Klick öffnet die Stunde
// auf dem Reiter „Rechnung“: dort steht, ob per Rechnung oder bar abgerechnet
// wird.
const ZUERST_ZEIGEN = 5;

function NochAbzurechnen({ gruppen }) {
  const [alle, setAlle] = useState(false);
  if (!gruppen?.length) return null;
  const gesamt = gruppen.reduce((s, g) => s + g.summeCent, 0);
  const anzahl = gruppen.reduce((s, g) => s + g.stunden.length, 0);
  return (
    <section className="rounded-[18px] border border-[var(--ck-line)] bg-[var(--ck-surface)] p-4" aria-label="Noch nicht abgerechnet">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-semibold">Noch nicht abgerechnet</h3>
        <span className="text-[13px] text-[var(--ck-muted)]">
          {anzahl === 1 ? "1 Stunde" : `${anzahl} Stunden`} · {formatPrice(gesamt)}
        </span>
      </div>
      <ul className="mt-2">
        {(alle ? gruppen : gruppen.slice(0, ZUERST_ZEIGEN)).map((g) => (
          <li key={g.schluessel} className="border-t border-[var(--ck-line)] py-2.5 first:border-t-0">
            <p className="text-sm font-semibold">{g.name}</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {g.stunden.map((st) => (
                <li key={st._id}>
                  <Link
                    href={`/admin?stunde=${encodeURIComponent(st._id)}&reiter=rechnung`}
                    title="Öffnen – dort Rechnung vorbereiten oder bar bezahlt verbuchen"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ck-surface2)] px-3 py-1.5 text-[13px] transition hover:bg-[var(--ck-surface3)]"
                  >
                    {formatDate(st.datum)}
                    {st.schueler ? ` · ${st.schueler}` : ""}
                    {st.fach ? ` · ${st.fach}` : ""} · {formatPrice(st.preisCent)}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        st.gehalten ? "bg-[var(--ck-warn-soft)] text-[var(--ck-warn)]" : "bg-[var(--ck-accent-soft)] text-[var(--ck-accent)]"
                      }`}
                    >
                      {st.gehalten ? "offen" : "geplant"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {gruppen.length > ZUERST_ZEIGEN ? (
        <button
          type="button"
          onClick={() => setAlle((v) => !v)}
          className="mt-2 text-[13px] font-semibold text-[var(--ck-muted)] underline underline-offset-2 transition hover:text-[var(--ck-accent)]"
        >
          {alle ? "Weniger zeigen" : `Alle ${gruppen.length} Familien zeigen`}
        </button>
      ) : null}
    </section>
  );
}
