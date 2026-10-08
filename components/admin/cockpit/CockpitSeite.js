"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { lessonDateOf } from "@/lib/bookings/order";
import { BEREICHE, monatsName } from "@/lib/umsatz/berechnung";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import StundenDrawer from "@/components/admin/cockpit/StundenDrawer";
import Ikone from "@/components/admin/ui/Symbole";
import {
  AreaChart,
  Badge,
  Button,
  Card,
  CardGrid,
  CardHead,
  Chevron,
  DayTile,
  Initials,
  Legend,
  Row,
  RowMain,
  StackedBar,
  Stat,
  errorText,
  formatDate,
  formatPrice,
  input,
  todayIso,
} from "@/components/admin/ui";

// Die Startseite der Verwaltung: Hero mit dem Umsatz aus dem Rechner,
// daneben die Schnellaktionen, darunter sieben Fenster im 12er-Raster.
// Aufbau nach der abgestimmten Vorlage lernsprung-cockpit.html.

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONATSKUERZEL = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export default function CockpitSeite({ stundeId, reiter, onStunde }) {
  const { adminFetch, notify } = useAdmin();
  const router = useRouter();
  const heute = todayIso();

  const [bereich, setBereich] = useState("1M");
  const [daten, setDaten] = useState(null);
  const [system, setSystem] = useState(null);

  const laden = useCallback(async () => {
    try {
      setDaten(await adminFetch(`/api/admin/cockpit?bereich=${bereich}`));
    } catch (err) {
      notify(errorText(err));
    }
  }, [adminFetch, bereich, notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      try {
        const s = await adminFetch("/api/admin/system");
        if (!abgebrochen) setSystem(s);
      } catch {
        if (!abgebrochen) setSystem({ dienste: [] });
      }
    })();
    return () => {
      abgebrochen = true;
    };
  }, [adminFetch]);

  const u = daten?.umsatz;

  return (
    <div className="space-y-5">
      {/* ---------- Hero ---------- */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-[var(--ck-r)] border border-[var(--ck-line)] bg-[var(--ck-surface)] p-[22px]">
          <Link href="/admin/finanzen?ansicht=umsatz" className="block">
            <span className="text-[13px] font-medium text-[var(--ck-muted)]">
              Einnahmen {daten ? monatsName(daten.monat) : "…"}
            </span>
            <span className="mt-1.5 block text-[40px] font-semibold leading-none tracking-[-1.8px] tabular-nums sm:text-[52px]">
              {euroGross(u?.umsatzCent || 0)}
            </span>
            <span className="mt-2 inline-flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              {u ? (
                <>
                  <span className={u.deltaCent >= 0 ? "text-[var(--ck-pos)]" : "text-[var(--ck-neg)]"}>
                    {u.deltaCent >= 0 ? "▲" : "▼"} {formatPrice(Math.abs(u.deltaCent))}
                    {u.deltaProzent == null ? "" : ` (${Math.abs(u.deltaProzent).toLocaleString("de-DE")} %)`}
                  </span>
                  <span className="font-medium text-[var(--ck-muted)]">ggü. {monatsName(u.vormonat)}</span>
                </>
              ) : (
                <span className="text-[var(--ck-muted)]">lädt …</span>
              )}
            </span>
          </Link>

          <AreaChart points={u?.kurve?.punkte || [0]} labels={u?.kurve?.labels || []} />

          <div className="mt-3 flex flex-wrap gap-1.5">
            {BEREICHE.map(([key, text]) => (
              <button
                key={key}
                type="button"
                onClick={() => setBereich(key)}
                aria-pressed={bereich === key}
                className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
                  bereich === key ? "bg-[var(--ck-text)] text-[var(--ck-on-text)]" : "text-[var(--ck-muted)] hover:text-[var(--ck-text)]"
                }`}
              >
                {text}
              </button>
            ))}
            <span className="ml-auto self-center text-xs text-[var(--ck-muted)]">
              aus Journal und Umsatzrechner ·{" "}
              <Link href="/admin/finanzen?ansicht=umsatz" className="underline underline-offset-2 hover:text-[var(--ck-accent)]">
                öffnen
              </Link>
            </span>
          </div>
        </section>

        <section className="rounded-[var(--ck-r)] border border-[var(--ck-line)] bg-[var(--ck-surface)] p-[22px]">
          <CardHead title="Schnellaktionen" />
          <div className="grid grid-cols-2 gap-3">
            <Schnellaktion symbol="telefon" titel="Telefonanfrage" hinweis="Aufnahmebogen + Papierakte" href="/admin/schueler?neu=1" />
            <Schnellaktion symbol="stundePlanen" titel="Stunde planen" hinweis="Termin + Jitsi-Raum" href="/admin/unterricht?neu=1" />
            <Schnellaktion symbol="rechnung" titel="Rechnung" hinweis="E-Rechnung mit GiroCode" href="/admin/finanzen?ansicht=rechnungen" />
            <Schnellaktion symbol="journal" titel="Buchung" hinweis="Soll / Haben erfassen" href="/admin/finanzen?ansicht=journal" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat title="Stunden im Monat" value={daten?.kennzahlen?.stundenImMonat ?? "–"} />
            <Stat title="Aktive Schüler" value={daten?.kennzahlen?.aktiveSchueler ?? "–"} />
            <Stat
              title="Offen"
              value={formatPrice(daten?.kennzahlen?.offenCent || 0)}
              tone={daten?.kennzahlen?.offenCent ? "amber" : "slate"}
            />
          </div>
        </section>
      </div>

      {/* ---------- Fenster ---------- */}
      <CardGrid>
        <Card span={7}>
          <CardHead title="Kommende Stunden">
            <Link href="/admin/kalender" className="text-[13px] font-medium text-[var(--ck-muted)] hover:text-[var(--ck-accent)]">
              Kalender →
            </Link>
          </CardHead>
          {!daten ? (
            <Laedt />
          ) : daten.kommende.length === 0 ? (
            <Leer text="Keine Stunden in der Zukunft eingetragen." />
          ) : (
            daten.kommende.map((b) => {
              const tag = lessonDateOf(b);
              return (
                <Row key={b._id} onClick={() => onStunde(b._id)}>
                  <DayTile day={tag.slice(8, 10)} month={MONATSKUERZEL[Number(tag.slice(5, 7)) - 1]} today={tag === heute} />
                  <RowMain
                    title={`${b.studentName || "—"} · ${b.subject || b.offerSnapshot?.title || ""}`}
                    subtitle={[b.requestedTime ? `${b.requestedTime} Uhr` : "", b.notes || b.offerSnapshot?.durationLabel]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                  <Badge tone={b.locationType === "online" ? "indigo" : "slate"}>
                    {b.locationType === "online" ? "Online" : "Präsenz"}
                  </Badge>
                  <Chevron />
                </Row>
              );
            })
          )}
        </Card>

        <Card span={5}>
          <CardHead title="Neue Anfragen">
            {daten?.anfragen?.length ? <Badge tone="indigo">{daten.anfragen.length} neu</Badge> : null}
          </CardHead>
          {!daten ? (
            <Laedt />
          ) : daten.anfragen.length === 0 ? (
            <Leer text="Alles beantwortet." />
          ) : (
            daten.anfragen.map((b) => (
              <Row key={b._id} onClick={() => onStunde(b._id)}>
                <Initials name={b.studentName} />
                <RowMain
                  title={`${b.studentName || "—"}${b.studentClass ? ` · Klasse ${b.studentClass}` : ""}`}
                  subtitle={[b.subject, kanalVon(b), b.notes].filter(Boolean).join(" · ")}
                />
                <Badge tone="indigo">Neu</Badge>
                <Chevron />
              </Row>
            ))
          )}
        </Card>

        <Card span={4}>
          <CardHead title="Rechnungen">
            <Link href="/admin/finanzen?ansicht=rechnungen" className="text-[13px] font-medium text-[var(--ck-muted)] hover:text-[var(--ck-accent)]">
              Alle →
            </Link>
          </CardHead>
          <p className="text-[13px] font-medium text-[var(--ck-muted)]">Offene Forderungen</p>
          <p className="mt-1 text-[30px] font-semibold tracking-[-0.8px] tabular-nums">
            {formatPrice(daten?.rechnungen?.forderungenCent || 0)}
          </p>
          <StackedBar
            parts={[
              { label: "Bezahlt", cents: daten?.rechnungen?.bezahltCent || 0, color: "var(--ck-pos)" },
              { label: "Offen", cents: daten?.rechnungen?.offenCent || 0, color: "var(--ck-warn)" },
              { label: "Überfällig", cents: daten?.rechnungen?.ueberfaelligCent || 0, color: "var(--ck-neg)" },
            ]}
          />
          <Legend
            items={[
              { label: "Bezahlt", value: formatPrice(daten?.rechnungen?.bezahltCent || 0), color: "var(--ck-pos)" },
              { label: "Offen", value: formatPrice(daten?.rechnungen?.offenCent || 0), color: "var(--ck-warn)" },
              { label: "Überfällig", value: formatPrice(daten?.rechnungen?.ueberfaelligCent || 0), color: "var(--ck-neg)" },
            ]}
          />
          <div className="mt-3">
            {daten?.rechnungen?.offene?.length ? (
              daten.rechnungen.offene.map((r) => (
                <Row
                  key={r._id}
                  onClick={() => router.push(`/admin/finanzen?ansicht=rechnungen&rechnung=${encodeURIComponent(r._id)}`)}
                >
                  <RowMain title={r.number || "Entwurf"} subtitle={`${r.name} · fällig ${formatDate(r.dueDate)}`} />
                  <span className="text-right">
                    <span className="block text-[15px] font-semibold tabular-nums">{formatPrice(r.totalCents)}</span>
                    <Badge tone={r.ueberfaellig ? "red" : "amber"}>{r.ueberfaellig ? "Überfällig" : "Offen"}</Badge>
                  </span>
                </Row>
              ))
            ) : (
              <Leer text="Keine offenen Rechnungen." />
            )}
          </div>
        </Card>

        <Card span={4}>
          <CardHead title="Nach Fach">
            <span className="text-[13px] text-[var(--ck-muted)]">{daten ? monatsName(daten.monat) : ""}</span>
          </CardHead>
          {!daten ? (
            <Laedt />
          ) : daten.nachFach.length === 0 ? (
            <Leer text="In diesem Monat noch keine Stunden." />
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {daten.nachFach.slice(0, 4).map((f) => (
                <div key={f.name} className="rounded-[16px] bg-[var(--ck-surface2)] p-3.5">
                  <p className="truncate text-[13px] font-medium text-[var(--ck-muted)]">{f.name}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{f.anzahl}</p>
                  <p className="text-[13px] text-[var(--ck-muted)]">{f.anzahl === 1 ? "Stunde" : "Stunden"}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card span={4}>
          <Todos todos={daten?.todos} onChanged={laden} />
        </Card>

        <Card span={8}>
          <CardHead title="Buchhaltung">
            <Link href="/admin/finanzen?ansicht=journal" className="text-[13px] font-medium text-[var(--ck-muted)] hover:text-[var(--ck-accent)]">
              EÜR {daten?.buchhaltung?.jahr || ""} →
            </Link>
          </CardHead>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat title="Einnahmen im Jahr" value={formatPrice(daten?.buchhaltung?.einnahmenCent || 0)} />
            <Stat title="Ausgaben im Jahr" value={formatPrice(daten?.buchhaltung?.ausgabenCent || 0)} />
            <Stat title="Überschuss" value={formatPrice(daten?.buchhaltung?.ueberschussCent || 0)} tone="emerald" />
            <Stat
              title="Grenze § 19"
              value={`${daten?.buchhaltung?.grenzeProzent ?? 0} %`}
              tone={(daten?.buchhaltung?.grenzeProzent ?? 0) >= 80 ? "amber" : "slate"}
            />
          </div>
          <div className="mt-3">
            {daten?.buchhaltung?.letzte?.length ? (
              daten.buchhaltung.letzte.map((e) => (
                <Row key={e._id} onClick={() => router.push("/admin/finanzen?ansicht=journal")}>
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg"
                    style={{
                      background: e.type === "income" ? "var(--ck-pos-soft)" : "var(--ck-neg-soft)",
                      color: e.type === "income" ? "var(--ck-pos)" : "var(--ck-neg)",
                    }}
                    aria-hidden="true"
                  >
                    {e.type === "income" ? "↓" : "↑"}
                  </span>
                  <RowMain title={e.description || "—"} subtitle={`${e.counterparty || ""} · ${formatDate(e.date)}`} />
                  <span
                    className="text-[15px] font-semibold tabular-nums"
                    style={{ color: e.type === "income" ? "var(--ck-pos)" : undefined }}
                  >
                    {e.type === "income" ? "+ " : "− "}
                    {formatPrice(e.amountCents)}
                  </span>
                </Row>
              ))
            ) : (
              <Leer text="Noch keine Buchungen in diesem Jahr." />
            )}
          </div>
        </Card>

        <Card span={4}>
          <CardHead title="System" />
          {!system ? (
            <Laedt />
          ) : system.dienste.length === 0 ? (
            <Leer text="Status nicht abrufbar." />
          ) : (
            system.dienste.map((d) => (
              <div key={d.name} className="flex items-start gap-3 border-t border-[var(--ck-line)] py-3 first:border-t-0">
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: AMPEL[d.status] || "var(--ck-faint)" }}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{d.name}</span>
                  <span className="block truncate text-[13px] text-[var(--ck-muted)]">
                    {d.ziel} · {d.text}
                  </span>
                </span>
              </div>
            ))
          )}
        </Card>
      </CardGrid>

      <StundenDrawer stundeId={stundeId} reiter={reiter} onClose={() => onStunde(null)} onChanged={laden} />
    </div>
  );
}

const AMPEL = {
  ok: "var(--ck-pos)",
  warn: "var(--ck-warn)",
  fehler: "var(--ck-neg)",
  unbekannt: "var(--ck-faint)",
};

// Die große Zahl trägt das €-Zeichen kleiner und gedämpft (wie in der
// Vorlage). formatPrice trennt mit einem geschützten Leerzeichen, deshalb
// wird das Zeichen entfernt statt am Leerzeichen getrennt.
function euroGross(cents) {
  const ganz = formatPrice(cents).replace(/\s*€\s*$/, "");
  return (
    <>
      {ganz} <span className="text-[26px] tracking-[-0.5px] text-[var(--ck-muted)]">€</span>
    </>
  );
}

function kanalVon(b) {
  if (b.source === "admin") return "selbst eingetragen";
  return "über die Website";
}

function Schnellaktion({ symbol, titel, hinweis, href }) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-4 rounded-[18px] bg-[var(--ck-surface2)] p-4 transition hover:bg-[var(--ck-surface3)]"
    >
      <span
        aria-hidden="true"
        className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--ck-accent-soft)] text-[var(--ck-accent)]"
      >
        <Ikone name={symbol} className="h-[22px] w-[22px]" />
      </span>
      <span>
        <b className="block text-[15px] font-semibold">{titel}</b>
        <span className="mt-0.5 block text-[12.5px] text-[var(--ck-muted)]">{hinweis}</span>
      </span>
    </Link>
  );
}

function Laedt() {
  return <p className="py-6 text-center text-sm text-[var(--ck-muted)]">Lädt …</p>;
}

function Leer({ text }) {
  return <p className="py-5 text-center text-sm text-[var(--ck-muted)]">{text}</p>;
}

// Eigene Notizen sind abhakbar. Die abgeleiteten Punkte darunter haben
// bewusst kein Häkchen: Sie verschwinden, sobald ihr Grund weg ist – ein
// Häkchen, das nichts ändert, wäre eine Attrappe. Stattdessen führt jede
// Zeile dorthin, wo sich der Punkt erledigen lässt.
function Todos({ todos, onChanged }) {
  const { adminFetch, notify } = useAdmin();
  const router = useRouter();
  const [neu, setNeu] = useState("");
  const [formOffen, setFormOffen] = useState(false);

  async function anlegen(e) {
    e.preventDefault();
    if (!neu.trim()) return;
    try {
      await adminFetch("/api/admin/todos", { method: "POST", body: JSON.stringify({ text: neu.trim() }) });
      setNeu("");
      setFormOffen(false);
      await onChanged();
    } catch (err) {
      notify(errorText(err));
    }
  }

  async function abhaken(todo) {
    try {
      await adminFetch(`/api/admin/todos/${todo._id}`, {
        method: "PATCH",
        body: JSON.stringify({ erledigt: !todo.erledigt }),
      });
      await onChanged();
    } catch (err) {
      notify(errorText(err));
    }
  }

  async function entfernen(todo) {
    try {
      await adminFetch(`/api/admin/todos/${todo._id}`, { method: "DELETE" });
      await onChanged();
    } catch (err) {
      notify(errorText(err));
    }
  }

  return (
    <>
      <CardHead title="To-dos">
        <button
          type="button"
          onClick={() => setFormOffen((v) => !v)}
          className="text-[13px] font-medium text-[var(--ck-muted)] hover:text-[var(--ck-accent)]"
        >
          + Neu
        </button>
      </CardHead>

      {formOffen ? (
        <form onSubmit={anlegen} className="mb-3 flex gap-2">
          <input
            autoFocus
            value={neu}
            onChange={(e) => setNeu(e.target.value)}
            maxLength={160}
            placeholder="Was ist zu tun?"
            aria-label="Neues To-do"
            className={`${input} mt-0`}
          />
          <Button type="submit" variant="primary">
            OK
          </Button>
        </form>
      ) : null}

      {!todos ? <Laedt /> : null}

      {todos?.eigene?.map((t) => (
        <div key={t._id} className="group flex items-start gap-3 border-t border-[var(--ck-line)] py-2.5 first:border-t-0">
          <button
            type="button"
            onClick={() => abhaken(t)}
            aria-pressed={t.erledigt}
            aria-label={t.erledigt ? `„${t.text}“ wieder öffnen` : `„${t.text}“ erledigen`}
            className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[7px] border-[1.5px] text-xs text-black transition ${
              t.erledigt ? "border-[var(--ck-accent)] bg-[var(--ck-accent)]" : "border-[var(--ck-faint)]"
            }`}
          >
            {t.erledigt ? <Ikone name="haken" className="h-3.5 w-3.5" strich={3} /> : null}
          </button>
          <span className="min-w-0 flex-1">
            <span className={`block text-sm font-semibold ${t.erledigt ? "text-[var(--ck-faint)] line-through" : ""}`}>{t.text}</span>
            {t.hinweis ? <span className="block text-[13px] text-[var(--ck-muted)]">{t.hinweis}</span> : null}
          </span>
          <button
            type="button"
            onClick={() => entfernen(t)}
            aria-label={`„${t.text}“ löschen`}
            className="text-[var(--ck-faint)] opacity-0 transition group-hover:opacity-100 hover:text-[var(--ck-neg)] focus:opacity-100"
          >
            ×
          </button>
        </div>
      ))}

      {todos?.abgeleitet?.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => router.push(t.href)}
          className="flex w-full items-start gap-3 border-t border-[var(--ck-line)] py-2.5 text-left first:border-t-0"
        >
          <span
            aria-hidden="true"
            className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[7px] bg-[var(--ck-surface2)] text-[var(--ck-muted)]"
          >
            <Ikone name="pfeil" className="h-3 w-3" strich={2.4} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t.text}</span>
            <span className="block text-[13px] text-[var(--ck-muted)]">{t.hinweis}</span>
          </span>
        </button>
      ))}

      {todos && todos.eigene.length === 0 && todos.abgeleitet.length === 0 ? <Leer text="Nichts offen." /> : null}
    </>
  );
}
