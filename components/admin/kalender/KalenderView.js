"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { lessonDateOf } from "@/lib/bookings/order";
import { lessonState } from "@/lib/lessons/state";
import { monatVerschieben, monatVon, monatsName } from "@/lib/umsatz/berechnung";
import { stundenNachTag, tageDesRasters } from "@/lib/admin/kalender";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import StundenDrawer from "@/components/admin/cockpit/StundenDrawer";
import { Badge, Button, Card, CardHead, Stat, errorText, formatDate, formatPrice, todayIso } from "@/components/admin/ui";

// Derselbe Bestand wie unter „Unterricht", nur als Monatsraster: Beim
// Planen schaut man auf freie Tage, beim Abarbeiten auf eine Liste.
// Ein Klick auf eine Stunde öffnet denselben Drawer wie im Cockpit.

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default function KalenderView({ stundeId, reiter, onStunde }) {
  const { adminFetch, notify } = useAdmin();
  const heute = todayIso();
  const [monat, setMonat] = useState(monatVon(heute));
  const [bookings, setBookings] = useState([]);
  const [geladen, setGeladen] = useState(false);

  const laden = useCallback(async () => {
    try {
      const b = await adminFetch("/api/admin/bookings");
      setBookings(b.bookings || []);
    } catch (err) {
      notify(errorText(err));
    } finally {
      setGeladen(true);
    }
  }, [adminFetch, notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  const raster = useMemo(() => tageDesRasters(monat), [monat]);
  const nachTag = useMemo(() => stundenNachTag(bookings.filter((b) => b.status !== "cancelled")), [bookings]);

  const imMonat = useMemo(
    () => bookings.filter((b) => (b.offerSnapshot?.type || "session") === "session" && monatVon(lessonDateOf(b)) === monat),
    [bookings, monat]
  );
  const gezaehlt = imMonat.filter((b) => b.status === "confirmed" && b.heldStatus !== "missed");
  const summeCent = gezaehlt.reduce((s, b) => s + (b.offerSnapshot?.priceCents || 0), 0);

  return (
    <div className="space-y-5">
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
        <div className="grid flex-1 grid-cols-3 gap-3 sm:max-w-md">
          <Stat title="Stunden" value={gezaehlt.length} />
          <Stat title="Anfragen" value={imMonat.filter((b) => b.status === "pending").length} tone={imMonat.some((b) => b.status === "pending") ? "amber" : "slate"} />
          <Stat title="Wert" value={formatPrice(summeCent)} />
        </div>
      </div>

      {/* Sieben Spalten brauchen Platz. Auf dem Handy wäre jede Zelle 45 px
          breit – dort führt die Liste darunter weiter, das Raster bleibt
          Tablets und dem Rechner vorbehalten. */}
      <Card span={12} className="hidden sm:block">
        <div className="grid grid-cols-7 gap-1.5">
          {WOCHENTAGE.map((t) => (
            <div key={t} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--ck-muted)]">
              {t}
            </div>
          ))}
          {raster.map((tag) => {
            const stunden = nachTag.get(tag.iso) || [];
            return (
              <div
                key={tag.iso}
                className={`min-h-24 rounded-[14px] border p-1.5 transition ${
                  tag.iso === heute
                    ? "border-[var(--ck-accent)] bg-[var(--ck-accent-soft)]"
                    : tag.imMonat
                      ? "border-[var(--ck-line)] bg-[var(--ck-surface2)]"
                      : "border-transparent bg-[var(--ck-surface2)]/40"
                }`}
              >
                <div className={`px-1 text-right text-xs font-semibold ${tag.imMonat ? "" : "text-[var(--ck-faint)]"}`}>{tag.tag}</div>
                <div className="mt-0.5 space-y-1">
                  {stunden.slice(0, 3).map((b) => (
                    <button
                      key={b._id}
                      type="button"
                      onClick={() => onStunde(b._id)}
                      title={`${b.requestedTime || ""} ${b.studentName} · ${b.subject}`}
                      className="block w-full truncate rounded-lg px-1.5 py-1 text-left text-[11px] font-semibold transition hover:brightness-125"
                      style={farbeFuer(b, heute)}
                    >
                      {b.requestedTime ? `${b.requestedTime} ` : ""}
                      {b.studentName}
                    </button>
                  ))}
                  {stunden.length > 3 ? (
                    <span className="block px-1.5 text-[11px] text-[var(--ck-muted)]">+ {stunden.length - 3} weitere</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-[12.5px] text-[var(--ck-muted)]">
          <Erklaerung farbe="var(--ck-accent-soft)" text="bestätigt" />
          <Erklaerung farbe="var(--ck-warn-soft)" text="Anfrage" />
          <Erklaerung farbe="var(--ck-pos-soft)" text="gehalten" />
          <Erklaerung farbe="var(--ck-surface3)" text="ausgefallen" />
        </div>
      </Card>

      <Card span={12}>
        <CardHead title={`Alle Stunden · ${monatsName(monat)}`} />
        {!geladen ? (
          <p className="py-5 text-center text-sm text-[var(--ck-muted)]">Lädt …</p>
        ) : imMonat.length === 0 ? (
          <p className="py-5 text-center text-sm text-[var(--ck-muted)]">In diesem Monat steht nichts an.</p>
        ) : (
          imMonat
            .slice()
            .sort((a, b) => lessonDateOf(a).localeCompare(lessonDateOf(b)) || String(a.requestedTime || "").localeCompare(String(b.requestedTime || "")))
            .map((b) => (
              <button
                key={b._id}
                type="button"
                onClick={() => onStunde(b._id)}
                className="flex w-full items-center gap-3 border-t border-[var(--ck-line)] py-2.5 text-left first:border-t-0 hover:bg-[var(--ck-surface2)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {b.studentName} <span className="font-normal text-[var(--ck-muted)]">· {b.subject}</span>
                  </span>
                  <span className="block truncate text-[13px] tabular-nums text-[var(--ck-muted)]">
                    {formatDate(lessonDateOf(b))}
                    {b.requestedTime ? ` · ${b.requestedTime} Uhr` : ""}
                  </span>
                </span>
                <Badge tone={lessonState(b, heute).tone}>{lessonState(b, heute).label}</Badge>
                <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {formatPrice(b.offerSnapshot?.priceCents || 0)}
                </span>
              </button>
            ))
        )}
      </Card>

      <AboKarte />

      <StundenDrawer stundeId={stundeId} reiter={reiter} onClose={() => onStunde(null)} onChanged={laden} />
    </div>
  );
}

// Abo-Link für Apple Kalender, Google Kalender & Co.: Der Feed liegt unter
// einem langen geheimen Link (lib/kalender/abo.js), das Handy holt ihn stündlich.
function AboKarte() {
  const { adminFetch, notify } = useAdmin();
  const [abo, setAbo] = useState(null);

  useEffect(() => {
    let abgebrochen = false;
    adminFetch("/api/admin/kalender/abo")
      .then((a) => !abgebrochen && setAbo(a))
      .catch(() => {});
    return () => {
      abgebrochen = true;
    };
  }, [adminFetch]);

  if (!abo?.url) return null;

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(abo.url);
      notify("Abo-Link kopiert.");
    } catch {
      notify("Kopieren nicht möglich – Link bitte von Hand markieren.");
    }
  }

  return (
    <Card span={12}>
      <CardHead title="Kalender abonnieren" />
      <p className="max-w-2xl text-sm text-[var(--ck-muted)]">
        Alle bestätigten Stunden und Anfragen erscheinen automatisch im Kalender deines iPhones und halten sich
        stündlich aktuell. Neue Stunden kommen dazu, abgesagte verschwinden wieder. Der Link ist geheim – nicht weitergeben.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={abo.webcal}
          className="whitespace-nowrap rounded-full bg-[var(--ck-accent)] px-4.5 py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
        >
          Auf diesem Gerät abonnieren
        </a>
        <Button onClick={kopieren}>Link kopieren</Button>
      </div>
      <p className="mt-3 text-xs text-[var(--ck-faint)]">
        Am iPhone: Link öffnen und „Abonnieren“ tippen – oder Einstellungen → Kalender → Accounts → Account hinzufügen →
        Andere → Kalenderabo hinzufügen und den kopierten Link einfügen.
      </p>
    </Card>
  );
}

function farbeFuer(b, heute) {
  if (b.status === "pending") return { background: "var(--ck-warn-soft)", color: "var(--ck-warn)" };
  if (b.heldStatus === "missed") return { background: "var(--ck-surface3)", color: "var(--ck-faint)" };
  if (lessonState(b, heute).key === "held") return { background: "var(--ck-pos-soft)", color: "var(--ck-pos)" };
  return { background: "var(--ck-accent-soft)", color: "var(--ck-accent)" };
}

function Erklaerung({ farbe, text }) {
  return (
    <span>
      <i className="mr-1.5 inline-block h-2 w-2 rounded-full align-[1px]" style={{ background: farbe }} />
      {text}
    </span>
  );
}
