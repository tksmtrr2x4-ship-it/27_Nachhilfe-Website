"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { lessonDateOf } from "@/lib/bookings/order";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { errorText, formatDate, formatPrice, input } from "@/components/admin/ui";

// Die Suche hinter ⌘K: Schüler:innen, Stunden und Rechnungen an einer Stelle.
//
// Sie lädt die drei Listen einmal beim Öffnen und filtert danach im Browser.
// Bei dieser Datenmenge (einige Hundert Einträge) ist das spürbar schneller
// als eine Anfrage pro Tastendruck – und es entsteht kein Endpunkt, der
// Suchbegriffe mit Namen in die Server-Logs schreibt.

const MAX_JE_GRUPPE = 5;

export default function Suche({ onClose }) {
  const { adminFetch, notify } = useAdmin();
  const router = useRouter();
  const [begriff, setBegriff] = useState("");
  const [daten, setDaten] = useState(null);
  const [aktiv, setAktiv] = useState(0);
  const feld = useRef(null);

  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      try {
        const [s, b, r] = await Promise.all([
          adminFetch("/api/admin/students"),
          adminFetch("/api/admin/bookings"),
          adminFetch("/api/admin/invoices"),
        ]);
        if (!abgebrochen) setDaten({ students: s.students || [], bookings: b.bookings || [], invoices: r.invoices || [] });
      } catch (err) {
        if (!abgebrochen) notify(errorText(err));
      }
    })();
    return () => {
      abgebrochen = true;
    };
  }, [adminFetch, notify]);

  useEffect(() => {
    feld.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const treffer = useMemo(() => finde(daten, begriff), [daten, begriff]);

  const gehe = useCallback(
    (ziel) => {
      onClose();
      router.push(ziel);
    },
    [onClose, router]
  );

  function onTaste(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAktiv((i) => Math.min(i + 1, treffer.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAktiv((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && treffer[aktiv]) {
      e.preventDefault();
      gehe(treffer[aktiv].href);
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-start justify-center bg-black/60 p-4 backdrop-blur-[3px] pt-[12vh]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Suche"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-[var(--ck-r)] border border-[var(--ck-line)] bg-[#0b0b0c] shadow-2xl"
      >
        <div className="p-3">
          <input
            ref={feld}
            type="search"
            value={begriff}
            onChange={(e) => {
              setBegriff(e.target.value);
              setAktiv(0);
            }}
            onKeyDown={onTaste}
            placeholder="Schüler, Stunde, Rechnung …"
            aria-label="Suchbegriff"
            className={`${input} mt-0 text-base`}
          />
        </div>

        <div className="max-h-[55vh] overflow-auto px-3 pb-3">
          {!daten ? (
            <p className="px-2 py-6 text-center text-sm text-[var(--ck-muted)]">Lädt …</p>
          ) : !begriff.trim() ? (
            <p className="px-2 py-6 text-center text-sm text-[var(--ck-muted)]">
              Name, Fach, Rechnungsnummer oder Datum eingeben. ↑ ↓ zum Wählen, ⏎ zum Öffnen.
            </p>
          ) : treffer.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-[var(--ck-muted)]">Nichts gefunden.</p>
          ) : (
            <ul>
              {treffer.map((t, i) => (
                <li key={t.key}>
                  <button
                    type="button"
                    onMouseEnter={() => setAktiv(i)}
                    onClick={() => gehe(t.href)}
                    className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition ${
                      i === aktiv ? "bg-[var(--ck-surface2)]" : ""
                    }`}
                  >
                    <span className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--ck-faint)]">{t.gruppe}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{t.titel}</span>
                      <span className="block truncate text-xs text-[var(--ck-muted)]">{t.zeile}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function passt(text, begriff) {
  return String(text || "").toLowerCase().includes(begriff);
}

export function finde(daten, roh) {
  const begriff = String(roh || "").trim().toLowerCase();
  if (!daten || begriff.length === 0) return [];

  const schueler = (daten.students || [])
    .filter((s) => passt(s.name, begriff) || passt(s.school, begriff) || passt(s.studentClass, begriff))
    .slice(0, MAX_JE_GRUPPE)
    .map((s) => ({
      key: `s-${s._id}`,
      gruppe: "Schüler:in",
      titel: s.name,
      zeile: [s.studentClass ? `Klasse ${s.studentClass}` : "", s.school].filter(Boolean).join(" · "),
      href: `/admin/schueler?schueler=${encodeURIComponent(s._id)}`,
    }));

  const stunden = (daten.bookings || [])
    .filter(
      (b) =>
        passt(b.studentName, begriff) ||
        passt(b.subject, begriff) ||
        passt(b.parentName, begriff) ||
        passt(lessonDateOf(b), begriff) ||
        passt(b.notes, begriff)
    )
    .slice(0, MAX_JE_GRUPPE)
    .map((b) => ({
      key: `b-${b._id}`,
      gruppe: "Stunde",
      titel: `${b.studentName || "—"} · ${b.subject || b.offerSnapshot?.title || ""}`,
      zeile: [formatDate(lessonDateOf(b)), b.requestedTime ? `${b.requestedTime} Uhr` : ""].filter(Boolean).join(" · "),
      href: `/admin/unterricht?stunde=${encodeURIComponent(b._id)}`,
    }));

  const rechnungen = (daten.invoices || [])
    .filter((r) => passt(r.number, begriff) || passt(r.recipient?.name, begriff) || passt(r.date, begriff))
    .slice(0, MAX_JE_GRUPPE)
    .map((r) => ({
      key: `r-${r._id}`,
      gruppe: "Rechnung",
      titel: r.number || "Entwurf",
      zeile: [r.recipient?.name, formatPrice(r.totalCents || 0)].filter(Boolean).join(" · "),
      href: `/admin/finanzen?ansicht=rechnungen&rechnung=${encodeURIComponent(r._id)}`,
    }));

  return [...stunden, ...schueler, ...rechnungen];
}
