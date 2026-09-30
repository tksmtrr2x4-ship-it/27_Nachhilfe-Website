"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import PapierakteButton from "@/components/admin/PapierakteButton";
import {
  Badge,
  Button,
  Card,
  CardHead,
  SearchInput,
  errorText,
  formatDate,
  formatPrice,
  plural,
} from "@/components/admin/ui";

// Alle Dateien an einem Ort: ausgestellte Rechnungen, Quittungen, Belege
// aus dem Journal und die Vorlagen zum Ausdrucken.
//
// Hier entsteht nichts Neues – die Dateien liegen dort, wo sie entstanden
// sind (lib/invoicing/storage.js, lib/bookkeeping/quittungStorage.js,
// lib/bookkeeping/receipts.js). Diese Ansicht ist der gemeinsame Zugang,
// weil man Dokumente sucht, ohne zu wissen, aus welchem Vorgang sie kamen.

export default function DokumenteView({ ansicht }) {
  const { adminFetch, pin, client, notify } = useAdmin();
  const jahr = new Date().getFullYear();

  const [rechnungen, setRechnungen] = useState(null);
  const [quittungen, setQuittungen] = useState(null);
  const [journal, setJournal] = useState(null);
  const [suche, setSuche] = useState("");

  const laden = useCallback(async () => {
    try {
      if (ansicht === "rechnungen" && !rechnungen) {
        const d = await adminFetch("/api/admin/invoices");
        setRechnungen((d.invoices || []).filter((i) => i.status !== "draft"));
      }
      if (ansicht === "quittungen" && !quittungen) {
        const d = await adminFetch(`/api/admin/ledger/quittungen?year=${jahr}`);
        setQuittungen(d.quittungen || []);
      }
      if (ansicht === "belege" && !journal) {
        const d = await adminFetch(`/api/admin/ledger?year=${jahr}`);
        setJournal((d.entries || []).filter((e) => e.receipt));
      }
    } catch (err) {
      notify(errorText(err));
    }
  }, [adminFetch, ansicht, jahr, journal, notify, quittungen, rechnungen]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  const passt = useCallback(
    (...felder) => {
      const begriff = suche.trim().toLowerCase();
      if (!begriff) return true;
      return felder.some((f) => String(f || "").toLowerCase().includes(begriff));
    },
    [suche]
  );

  const gefilterteRechnungen = useMemo(
    () => (rechnungen || []).filter((i) => passt(i.number, i.recipient?.name, i.studentName, i.date)),
    [rechnungen, passt]
  );
  const gefilterteQuittungen = useMemo(
    () => (quittungen || []).filter((q) => passt(q.number, q.description, q.paymentDate)),
    [quittungen, passt]
  );
  const gefilterteBelege = useMemo(
    () => (journal || []).filter((e) => passt(e.entryNumber, e.description, e.counterparty, e.date, e.receipt?.originalName)),
    [journal, passt]
  );

  async function laden_datei(url, name) {
    try {
      await client.download(url, name);
    } catch (err) {
      notify(errorText(err));
    }
  }

  return (
    <div className="space-y-5">
      {ansicht !== "vorlagen" ? (
        <div className="max-w-md">
          <SearchInput value={suche} onChange={setSuche} placeholder="Nummer, Name, Datum …" label="In den Dokumenten suchen" />
        </div>
      ) : null}

      {ansicht === "rechnungen" ? (
        <Card span={12}>
          <CardHead title="Ausgestellte Rechnungen">
            <span className="text-[13px] text-[var(--ck-muted)]">{plural(gefilterteRechnungen.length, "Datei", "Dateien")}</span>
          </CardHead>
          {!rechnungen ? (
            <Laedt />
          ) : gefilterteRechnungen.length === 0 ? (
            <Leer text="Keine ausgestellten Rechnungen gefunden." />
          ) : (
            gefilterteRechnungen.map((i) => (
              <Zeile
                key={i._id}
                art="PDF"
                farbe="#c43"
                titel={`${i.number || "ohne Nummer"} · ${i.recipient?.name || ""}`}
                hinweis={`${formatDate(i.date)} · ${formatPrice(i.totalCents || 0)}${i.type === "storno" ? " · Storno" : ""}`}
                badge={<Badge tone={tonFuerRechnung(i)}>{textFuerRechnung(i)}</Badge>}
              >
                <Button
                  variant="bright"
                  onClick={() => laden_datei(`/api/admin/invoices/${i._id}/pdf`, `${i.number || "rechnung"}.pdf`)}
                >
                  Öffnen
                </Button>
              </Zeile>
            ))
          )}
        </Card>
      ) : null}

      {ansicht === "quittungen" ? (
        <Card span={12}>
          <CardHead title={`Quittungen ${jahr}`}>
            <span className="text-[13px] text-[var(--ck-muted)]">{plural(gefilterteQuittungen.length, "Datei", "Dateien")}</span>
          </CardHead>
          {!quittungen ? (
            <Laedt />
          ) : gefilterteQuittungen.length === 0 ? (
            <Leer text="In diesem Jahr wurde noch keine Quittung ausgestellt." />
          ) : (
            gefilterteQuittungen.map((q) => (
              <Zeile
                key={q.entryId}
                art="PDF"
                farbe="#2a5bd7"
                titel={`Quittung ${q.number || ""}`}
                hinweis={`${formatDate(q.paymentDate)} · ${q.description || ""}`}
                badge={q.reversed ? <Badge tone="red">storniert</Badge> : null}
              >
                <Button
                  variant="bright"
                  onClick={() => laden_datei(`/api/admin/ledger/${q.entryId}/quittung`, `${q.number || "quittung"}.pdf`)}
                >
                  Öffnen
                </Button>
              </Zeile>
            ))
          )}
        </Card>
      ) : null}

      {ansicht === "belege" ? (
        <Card span={12}>
          <CardHead title={`Belege im Journal ${jahr}`}>
            <span className="text-[13px] text-[var(--ck-muted)]">{plural(gefilterteBelege.length, "Datei", "Dateien")}</span>
          </CardHead>
          {!journal ? (
            <Laedt />
          ) : gefilterteBelege.length === 0 ? (
            <Leer text="Zu keinem Journaleintrag ist ein Beleg hinterlegt." />
          ) : (
            gefilterteBelege.map((e) => (
              <Zeile
                key={e._id}
                art={e.receipt?.originalName?.toLowerCase().endsWith(".pdf") ? "PDF" : "BILD"}
                farbe={e.type === "income" ? "#2fd07a" : "#8a8a92"}
                titel={e.receipt?.originalName || "Beleg"}
                hinweis={`${e.entryNumber} · ${formatDate(e.date)} · ${e.description || ""} · ${formatPrice(e.amountCents)}`}
              >
                <Button variant="bright" onClick={() => laden_datei(`/api/admin/ledger/${e._id}/receipt`, e.receipt?.originalName || "beleg")}>
                  Öffnen
                </Button>
              </Zeile>
            ))
          )}
        </Card>
      ) : null}

      {ansicht === "vorlagen" ? (
        <Card span={12}>
          <CardHead title="Vorlagen zum Ausdrucken" />
          <p className="mb-3 text-[13px] text-[var(--ck-muted)]">
            Wird bei jedem Abruf neu erzeugt und nirgends gespeichert. Das Tagebuchblatt einer einzelnen Stunde liegt
            in der Stunde selbst – Kalender oder Unterricht öffnen, Reiter „Akte“.
          </p>
          <Zeile art="DOCX" farbe="#2a5bd7" titel="Aufnahmebogen (Papierakte)" hinweis="leeres Blatt für das erste Telefonat">
            <PapierakteButton pin={pin} notify={notify} variant="bright">
              Erzeugen
            </PapierakteButton>
          </Zeile>
        </Card>
      ) : null}

      <p className="rounded-[18px] border border-[var(--ck-line)] bg-[var(--ck-surface)] p-4 text-[13px] leading-relaxed text-[var(--ck-muted)]">
        Rechnungen und Quittungen sind unveränderlich und bleiben nach § 147 AO zehn Jahre erhalten. Was hier steht,
        wird nur angezeigt und heruntergeladen – geändert wird nichts.
      </p>
    </div>
  );
}

function tonFuerRechnung(i) {
  if (i.status === "paid") return "emerald";
  if (i.status === "cancelled") return "red";
  if (i.overdue) return "red";
  return "amber";
}

function textFuerRechnung(i) {
  if (i.status === "paid") return "bezahlt";
  if (i.status === "cancelled") return "storniert";
  if (i.overdue) return "überfällig";
  if (i.status === "sent") return "versendet";
  return "ausgestellt";
}

function Zeile({ art, farbe, titel, hinweis, badge, children }) {
  return (
    <div className="flex items-center gap-3 border-t border-[var(--ck-line)] py-2.5 first:border-t-0">
      <span
        aria-hidden="true"
        className="grid h-10.5 w-9 shrink-0 place-items-center rounded-[7px] text-[10px] font-bold text-white"
        style={{ background: farbe }}
      >
        {art}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{titel}</span>
        <span className="block truncate text-[13px] text-[var(--ck-muted)]">{hinweis}</span>
      </span>
      {badge}
      {children}
    </div>
  );
}

function Laedt() {
  return <p className="py-6 text-center text-sm text-[var(--ck-muted)]">Lädt …</p>;
}

function Leer({ text }) {
  return <p className="py-6 text-center text-sm text-[var(--ck-muted)]">{text}</p>;
}
