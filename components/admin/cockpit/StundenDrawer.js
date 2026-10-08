"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { locationLabel } from "@/lib/format";
import { lessonDateOf } from "@/lib/bookings/order";
import { billingState, lessonState } from "@/lib/lessons/state";
import { hasDiary } from "@/lib/lessons/diary";
import { AUSFALL_ARTEN } from "@/lib/ausfall/berechnung";
import { hatAusfallVerguetung, isLessonLocked } from "@/lib/lessons/rules";
import AusfallDialog from "@/components/admin/cockpit/AusfallDialog";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import Ikone, { SYMBOL_FUER_ANSICHT } from "@/components/admin/ui/Symbole";
import { TagebuchFormular, downloadTagebuchblatt } from "@/components/admin/management/TagebuchDialog";
import LessonForm from "@/components/admin/management/LessonForm";
import { useBuchungLoeschen } from "@/components/admin/management/useBuchungLoeschen";
import PapierakteButton from "@/components/admin/PapierakteButton";
import PaymentDialog from "@/components/admin/management/PaymentDialog";
import { issueQuittung, openQuittung, quittungAction } from "@/components/admin/finanzen/quittungActions";
import {
  Badge,
  Button,
  Drawer,
  DrawerClose,
  Initials,
  KeyValues,
  Modal,
  Section,
  Timeline,
  errorText,
  formatDate,
  formatPrice,
  useDialogs,
} from "@/components/admin/ui";

// Ebene 2: eine Stunde in allem, was dazugehört. Der Drawer steht in der
// Adresse (?stunde=<id>&reiter=<name>), damit er verlinkbar ist und der
// Zurück-Knopf des Browsers ihn schließt.
//
// Hier entsteht keine neue Fachlogik: Tagebuch, Rechnungsentwurf,
// Papierakte und Storno sind dieselben Wege wie in den Listenansichten.

const REITER = [
  ["uebersicht", "Übersicht"],
  ["tagebuch", "Tagebuch"],
  ["rechnung", "Rechnung"],
  ["akte", "Akte"],
];

const JITSI = "https://meet.lernsprung-vs.de";

export default function StundenDrawer({ stundeId, reiter = "uebersicht", onClose, onChanged }) {
  const { adminFetch, pin, notify } = useAdmin();
  const { confirm } = useDialogs();
  const loescheBuchung = useBuchungLoeschen();
  const router = useRouter();
  const [daten, setDaten] = useState(null);
  const [verschieben, setVerschieben] = useState(false);
  const [ausfallOffen, setAusfallOffen] = useState(false);
  const [zahlungOffen, setZahlungOffen] = useState(false);
  // Der Reiter kommt aus der Adresse und lässt sich im Drawer umschalten.
  // Beim Wechsel der Stunde (oder wenn die Adresse einen anderen Reiter
  // nennt) gilt wieder die Adresse – deshalb der Vergleich beim Rendern
  // statt eines Effekts, der eine zweite Runde auslösen würde.
  const adresse = `${stundeId}|${reiter}`;
  const [reiterState, setReiterState] = useState({ adresse, aktiv: reiter });
  if (reiterState.adresse !== adresse) {
    setReiterState({ adresse, aktiv: REITER.some(([key]) => key === reiter) ? reiter : "uebersicht" });
  }
  const aktiv = reiterState.aktiv;
  const setAktiv = (key) => setReiterState({ adresse, aktiv: key });

  // Die Seite gibt bei jedem Neuzeichnen eine neue onClose-Funktion herein.
  // Hinge `laden` direkt daran, lüde der Drawer seine Daten bei jedem
  // Neuzeichnen der Seite neu – und nach dem Löschen noch einmal die eben
  // gelöschte Stunde ("Stunde nicht gefunden"). Deshalb über eine Referenz.
  const schliessen = useRef(onClose);
  useEffect(() => {
    schliessen.current = onClose;
  });

  const laden = useCallback(async () => {
    if (!stundeId) return;
    try {
      setDaten(await adminFetch(`/api/admin/lessons/${stundeId}/detail`));
    } catch (err) {
      notify(errorText(err));
      schliessen.current();
    }
  }, [adminFetch, notify, stundeId]);

  useEffect(() => {
    if (!stundeId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden, stundeId]);

  const l = daten?.lesson;
  const offen = Boolean(stundeId);

  async function aktualisieren() {
    await laden();
    await onChanged?.();
  }

  async function ausfallZurueck() {
    const ok = await confirm({
      title: "Ausfallvergütung zurücknehmen?",
      message: "Der Stundenpreis gilt wieder, die Stunde bleibt als ausgefallen markiert und wird nicht abgerechnet. Das Protokoll behält den Eintrag.",
      confirmLabel: "Zurücknehmen",
    });
    if (!ok) return;
    try {
      await adminFetch(`/api/admin/lessons/${l._id}/ausfall`, { method: "DELETE", body: JSON.stringify({}) });
      notify("Ausfallvergütung zurückgenommen.");
      await aktualisieren();
    } catch (err) {
      notify(errorText(err));
    }
  }

  async function absagen() {
    const ok = await confirm({
      title: "Termin absagen?",
      message: "Die Stunde bleibt sichtbar, gilt aber als storniert und wird nicht abgerechnet.",
      confirmLabel: "Absagen",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminFetch(`/api/admin/bookings/${l._id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });
      notify("Termin abgesagt.");
      await aktualisieren();
    } catch (err) {
      notify(errorText(err));
    }
  }

  // Löschen mit Grund und Protokoll, auch wenn es „gegen die Logik" geht –
  // Fehler werden nicht per Storno gelöst (siehe useBuchungLoeschen). Danach
  // gibt es die Stunde nicht mehr, also schließt der Drawer.
  async function loeschen() {
    if (!(await loescheBuchung(l))) return;
    onClose();
    await onChanged?.();
  }

  async function rechnungAnlegen() {
    try {
      const data = await adminFetch("/api/admin/invoices", {
        method: "POST",
        body: JSON.stringify({ bookingId: l._id, bookingIds: [...new Set(daten.abrechenbar.map((z) => z._id))] }),
      });
      onClose();
      router.push(`/admin/finanzen?ansicht=rechnungen&rechnung=${data.invoice._id}`);
    } catch (err) {
      notify(errorText(err));
    }
  }

  // Eine Stunde, die erst morgen stattfindet, lässt sich nicht abrechnen –
  // bar bezahlt wird meist danach. Wer im Voraus kassiert hat, markiert sie
  // hier als gehalten und bucht die Zahlung gleich im Anschluss.
  async function alsGehaltenMarkieren() {
    try {
      await adminFetch(`/api/admin/bookings/${l._id}`, { method: "PATCH", body: JSON.stringify({ heldStatus: "held" }) });
      await aktualisieren();
      setZahlungOffen(true);
    } catch (err) {
      notify(errorText(err));
    }
  }

  return (
    <>
    <Drawer open={offen} onClose={onClose} labelledBy="drawer-titel">
      <DrawerClose onClose={onClose} />

      {!l ? (
        <p className="p-7 text-sm text-[var(--ck-muted)]">{offen ? "Lädt …" : ""}</p>
      ) : (
        <>
          <div className="px-7 pt-6">
            <p className="text-[13px] font-medium text-[var(--ck-muted)]">
              {formatDate(lessonDateOf(l))}
              {l.requestedTime ? ` · ${l.requestedTime} Uhr` : ""}
            </p>
            <div className="mt-1.5 flex items-center gap-3.5 pr-10">
              <Initials name={l.studentName} size={54} />
              <div className="min-w-0">
                <h2 id="drawer-titel" className="truncate text-[26px] font-semibold tracking-[-0.6px]">
                  {l.studentName || "—"}
                </h2>
                <p className="truncate text-[13px] text-[var(--ck-muted)]">
                  {[l.studentClass ? `Klasse ${l.studentClass}` : "", l.subject].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={l.locationType === "online" ? "indigo" : "slate"}>{locationLabel(l) || "Ort offen"}</Badge>
              {l.offerSnapshot?.durationLabel ? <Badge>{l.offerSnapshot.durationLabel}</Badge> : null}
              <Badge>{formatPrice(l.offerSnapshot?.priceCents || 0)}</Badge>
              <Badge tone={lessonState(l, daten.heute).tone}>{lessonState(l, daten.heute).label}</Badge>
              <Badge tone={hasDiary(l) ? "emerald" : "amber"}>{hasDiary(l) ? "Tagebuch geführt" : "Tagebuch fehlt"}</Badge>
            </div>
          </div>

          <div className="mt-5 flex gap-1 border-b border-[var(--ck-line)] px-2 sm:overflow-x-auto sm:px-7">
            {REITER.map(([key, text]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAktiv(key)}
                aria-current={aktiv === key ? "page" : undefined}
                className={`-mb-px flex min-w-0 flex-1 flex-col items-center gap-1 border-b-2 px-1 py-2.5 text-[12px] font-semibold transition sm:flex-none sm:flex-row sm:gap-1.5 sm:px-3 sm:py-3 sm:text-sm ${
                  aktiv === key ? "border-[var(--ck-accent)] text-[var(--ck-text)]" : "border-transparent text-[var(--ck-muted)]"
                }`}
              >
                <Ikone name={SYMBOL_FUER_ANSICHT[key]} className={`h-5 w-5 sm:h-[17px] sm:w-[17px] ${aktiv === key ? "text-[var(--ck-accent)]" : ""}`} />
                {text}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto px-7 pb-8 pt-5">
            {aktiv === "uebersicht" ? (
              <>
                <Section title="Stunde">
                  <KeyValues
                    items={[
                      ["Thema", l.diary?.topic || l.notes || "—"],
                      ["Ort", locationLabel(l) || "—"],
                      hatAusfallVerguetung(l)
                        ? ["Ausfallvergütung", `${formatPrice(l.offerSnapshot?.priceCents || 0)} (Stundenpreis ${formatPrice(l.ausfall.stundenpreisCent)})`]
                        : ["Preis", `${formatPrice(l.offerSnapshot?.priceCents || 0)} · ${l.offerSnapshot?.durationLabel || ""}`],
                      ["Abrechnung", abrechnungsText(l, daten.heute)],
                      daten.customer ? ["Rechnung an", daten.customer.name] : null,
                    ]}
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    {l.meetingToken ? (
                      <a
                        href={`${JITSI}/${encodeURIComponent(l.meetingToken)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full bg-[var(--ck-accent)] px-4.5 py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
                      >
                        Jitsi-Raum öffnen
                      </a>
                    ) : null}
                    <Button
                      onClick={() => setVerschieben(true)}
                      disabled={l.source !== "admin" || isLessonLocked(l)}
                      title={
                        l.source !== "admin"
                          ? "Online gebuchte Termine lassen sich hier nicht umlegen – bitte kurz mit der Familie sprechen."
                          : isLessonLocked(l)
                            ? "Die Stunde ist abgerechnet."
                            : undefined
                      }
                    >
                      Verschieben
                    </Button>
                    <Button variant="danger" onClick={absagen} disabled={l.status === "cancelled"}>
                      Absagen
                    </Button>
                    {l.status === "confirmed" && l.offerSnapshot?.type === "session" && !hatAusfallVerguetung(l) && !isLessonLocked(l) ? (
                      <>
                        <Button onClick={() => setAusfallOffen("no_show")} title="Ohne Absage nicht erschienen – Ausfallvergütung nach § 6 AGB">
                          Nicht erschienen
                        </Button>
                        <Button onClick={() => setAusfallOffen("late_cancel")} title="Zu spät abgesagt – Ausfallvergütung nach § 6 AGB">
                          Zu spät abgesagt
                        </Button>
                      </>
                    ) : null}
                    {hatAusfallVerguetung(l) && !isLessonLocked(l) ? <Button onClick={ausfallZurueck}>Ausfallvergütung zurücknehmen</Button> : null}
                    <Button
                      variant="danger"
                      onClick={loeschen}
                      title="Entfernt den Eintrag ganz – mit Grund im Löschprotokoll. Zum Absagen oben „Absagen“ nehmen."
                    >
                      Löschen
                    </Button>
                    {l.parentEmail ? (
                      <a
                        href={`mailto:${l.parentEmail}`}
                        className="rounded-full bg-[var(--ck-surface2)] px-4.5 py-2.5 text-sm font-semibold transition hover:bg-[var(--ck-surface3)]"
                      >
                        Kontaktieren
                      </a>
                    ) : null}
                  </div>
                </Section>

                {l.ausfall ? (
                  <Section title="Ausfallprotokoll">
                    <KeyValues
                      items={[
                        ["Art", AUSFALL_ARTEN[l.ausfall.art] || "—"],
                        l.ausfall.absageAm ? ["Absage", `${l.ausfall.absageAm}${l.ausfall.kanal ? ` · ${l.ausfall.kanal}` : ""}`] : null,
                        l.ausfall.wartezeitEingehalten != null ? ["Wartezeit eingehalten", l.ausfall.wartezeitEingehalten ? "ja" : "nein"] : null,
                        ["Stundenanteil", `${l.ausfall.prozent} % von ${formatPrice(l.ausfall.stundenpreisCent)} = ${formatPrice(l.ausfall.stundenCent)}`],
                        ["Vorbereitung", `${l.ausfall.prepProzent} % von ${l.ausfall.vorbereitungMin} Min. à ${formatPrice(l.ausfall.satzCent)}/h = ${formatPrice(l.ausfall.vorbereitungCent)}`],
                        ["Gesamt", formatPrice(l.ausfall.totalCent)],
                        ["AGB-Version", l.ausfall.termsVersion],
                        l.ausfall.notiz ? ["Notiz", l.ausfall.notiz] : null,
                        l.ausfall.aufgehoben ? ["Status", "zurückgenommen"] : null,
                      ]}
                    />
                    <ul className="mt-3 space-y-1.5 text-[13px] text-[var(--ck-muted)]">
                      {(l.ausfall.protokoll || []).map((p, i) => (
                        <li key={i}>
                          <span className="tabular-nums text-[var(--ck-faint)]">{formatDate(String(p.am).slice(0, 10))}</span> · {p.text}
                        </li>
                      ))}
                    </ul>
                  </Section>
                ) : null}

                <Section title="Ablauf">
                  <Timeline
                    steps={[
                      {
                        text: "Anfrage eingegangen",
                        hint: `${l.source === "admin" ? "selbst eingetragen" : "über die Website"} · ${formatDate(String(l.createdAt || "").slice(0, 10))}`,
                        done: true,
                      },
                      { text: "Termin bestätigt", hint: l.status === "pending" ? "steht noch aus" : "bestätigt", done: l.status !== "pending" },
                      {
                        text: "Stunde gehalten",
                        hint: lessonState(l, daten.heute).label,
                        done: lessonState(l, daten.heute).key === "held",
                      },
                      {
                        text: "Abgerechnet",
                        hint: abrechnungsText(l, daten.heute),
                        done: ABGERECHNET.includes(billingState(l, daten.heute).key),
                      },
                    ]}
                  />
                </Section>

                <Section title="Letzter Tagebucheintrag">
                  {daten.letzter ? (
                    <p className="text-sm leading-relaxed">
                      <span className="text-[var(--ck-muted)]">
                        {formatDate(daten.letzter.datum)}
                        {daten.letzter.dieseStunde ? " · diese Stunde" : ""}
                      </span>{" "}
                      — {daten.letzter.text || daten.letzter.thema}
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--ck-muted)]">Für diese Schülerin / diesen Schüler gibt es noch keinen Eintrag.</p>
                  )}
                </Section>
              </>
            ) : null}

            {aktiv === "tagebuch" ? (
              <>
                <Section title="Eintrag zu dieser Stunde">
                  <TagebuchFormular lesson={l} onSaved={aktualisieren} />
                </Section>
                <Section title="Verlauf">
                  {daten.verlauf?.length ? (
                    daten.verlauf.map((e) => (
                      <div key={e._id} className="border-t border-[var(--ck-line)] py-3 first:border-t-0 first:pt-0">
                        <div className="flex justify-between gap-3 text-[12.5px] text-[var(--ck-muted)]">
                          <span>{formatDate(e.datum)}</span>
                          <span>{e.fach}</span>
                        </div>
                        {e.thema ? <p className="mt-1 text-sm font-semibold">{e.thema}</p> : null}
                        {e.text ? <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[var(--ck-text-soft)]">{e.text}</p> : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--ck-muted)]">Noch keine früheren Einträge.</p>
                  )}
                </Section>
              </>
            ) : null}

            {aktiv === "rechnung" ? (
              <RechnungsReiter
                daten={daten}
                onRechnung={rechnungAnlegen}
                onZahlung={() => setZahlungOffen(true)}
                onGehalten={alsGehaltenMarkieren}
                onQuittung={async (entry) => {
                  if (quittungAction(entry).kind === "open") await openQuittung({ pin, entry, notify });
                  else await issueQuittung({ adminFetch, pin, entry, notify });
                  await aktualisieren();
                }}
              />
            ) : null}

            {aktiv === "akte" ? (
              <>
                <Section title="Schülerakte">
                  <KeyValues
                    items={[
                      ["Schüler:in", daten.student?.name || l.studentName || "—"],
                      ["Klasse", daten.student?.studentClass || l.studentClass || "—"],
                      ["Schule", daten.student?.school || "—"],
                      ["Fächer", (daten.student?.subjects || []).map((f) => f.subject).join(", ") || l.subject || "—"],
                      ["Kontakt", [l.parentName, l.parentEmail].filter(Boolean).join(" · ") || "—"],
                      ["Erfasst", `${l.source === "admin" ? "selbst eingetragen" : "über die Website"} · ${formatDate(String(l.createdAt || "").slice(0, 10))}`],
                      [
                        "Angelegt als Akte",
                        daten.student ? <Badge tone="emerald">ja</Badge> : <Badge tone="amber">noch nicht zugeordnet</Badge>,
                      ],
                    ]}
                  />
                  {daten.student ? (
                    <div className="mt-4">
                      <Button
                        onClick={() => {
                          onClose();
                          router.push(`/admin/schueler?id=${daten.student._id}`);
                        }}
                      >
                        Ganze Akte öffnen
                      </Button>
                    </div>
                  ) : null}
                </Section>

                <Section title="Dokumente">
                  <Datei
                    art="DOCX"
                    farbe="#2a5bd7"
                    titel="Tagebuchblatt dieser Stunde"
                    hinweis="mit allem, was im Tagebuch steht – sonst leer zum Ausfüllen"
                  >
                    <Button
                      variant="bright"
                      onClick={async () => {
                        try {
                          await downloadTagebuchblatt(pin, l);
                        } catch (err) {
                          notify(errorText(err));
                        }
                      }}
                    >
                      Erzeugen
                    </Button>
                  </Datei>
                  <Datei art="DOCX" farbe="#2a5bd7" titel="Aufnahmebogen (Papierakte)" hinweis="leeres Blatt zum Ausfüllen von Hand">
                    <PapierakteButton pin={pin} notify={notify} variant="bright">
                      Erzeugen
                    </PapierakteButton>
                  </Datei>
                  {daten.invoice ? (
                    <Datei art="PDF" farbe="#c43" titel={`Rechnung ${daten.invoice.number || ""}`} hinweis={`ausgestellt am ${formatDate(daten.invoice.date)}`}>
                      <Button
                        variant="bright"
                        onClick={() => {
                          onClose();
                          router.push(`/admin/finanzen?ansicht=rechnungen&rechnung=${daten.invoice._id}`);
                        }}
                      >
                        Öffnen
                      </Button>
                    </Datei>
                  ) : null}
                </Section>
              </>
            ) : null}
          </div>
        </>
      )}

    </Drawer>

    {/* Die Dialoge stehen neben dem Drawer, nicht darin: Ein verschobenes
        Element (translate) wird zum Bezugsrahmen für alles, was darin
        „fixed" positioniert ist – der Dialog säße dann im Drawer statt
        mittig im Fenster. */}
      {verschieben && l ? (
        <Modal title="Stunde verschieben" onClose={() => setVerschieben(false)} wide>
          <LessonForm
            lesson={l}
            adminFetch={adminFetch}
            setNotice={notify}
            fixedStudent={daten.student || null}
            students={daten.student ? [daten.student] : []}
            onCancel={() => setVerschieben(false)}
            onSaved={async () => {
              setVerschieben(false);
              await aktualisieren();
            }}
          />
        </Modal>
      ) : null}

    {ausfallOffen && l ? (
      <AusfallDialog
        lesson={l}
        vorgabeArt={ausfallOffen}
        studentClass={daten.student?.studentClass}
        adminFetch={adminFetch}
        notify={notify}
        onClose={() => setAusfallOffen(false)}
        onSaved={async () => {
          setAusfallOffen(false);
          await aktualisieren();
        }}
      />
    ) : null}

    {zahlungOffen && l && daten.student ? (
      <PaymentDialog
        student={daten.student}
        customer={daten.customer}
        lessons={[l]}
        totalCents={l.offerSnapshot?.priceCents || 0}
        adminFetch={adminFetch}
        pin={pin}
        setNotice={notify}
        onClose={() => setZahlungOffen(false)}
        onSaved={async () => {
          setZahlungOffen(false);
          await aktualisieren();
        }}
      />
    ) : null}
    </>
  );
}

// Abgerechnet heißt: Rechnung, direkt bezahlt, vor Einführung abgerechnet oder
// online bezahlt – dieselben Wege wie in lib/lessons/state.js (billingState),
// nach dem sich auch die Stundenliste richtet.
const ABGERECHNET = ["invoiced", "direct", "settled", "online"];

function abrechnungsText(lesson, heute) {
  const b = billingState(lesson, heute);
  if (b.key === "invoiced") return "auf einer Rechnung";
  if (b.key === "direct") return `${b.label.charAt(0).toLowerCase()}${b.label.slice(1)} (ohne Rechnung)`;
  if (b.key === "open") return "noch offen";
  if (b.key === "none") return "noch nicht fällig";
  return b.label;
}

function Datei({ art, farbe, titel, hinweis, children }) {
  return (
    <div className="mt-2 flex items-center gap-3 rounded-[14px] bg-[var(--ck-surface2)] p-3 first:mt-0">
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
      {children}
    </div>
  );
}

// Der Entwurf zeigt, was auf der nächsten Rechnung stünde – im Layout des
// fertigen Dokuments, damit man vor dem Ausstellen sieht, was ankommt.
// Ausgestellt und versendet wird danach im Bereich Finanzen mit der
// vorhandenen Logik (Nummernkreis, PDF, XML, GiroCode, Mail).
function RechnungsReiter({ daten, onRechnung, onZahlung, onGehalten, onQuittung }) {
  const summeCent = (daten.abrechenbar || []).reduce((s, z) => s + z.preisCent, 0);
  const vorhanden = daten.invoice;
  // Ist diese Stunde schon auf anderem Weg abgerechnet, zeigt der Entwurf nur
  // noch die übrigen offenen Stunden der Familie – das muss dastehen, sonst
  // sucht man die eigene Stunde vergeblich darin.
  const dieseImEntwurf = (daten.abrechenbar || []).some((z) => z._id === daten.lesson._id);
  const zuerstZahlung = !vorhanden && Boolean(daten.zahlung);

  return (
    <>
      {zuerstZahlung ? <OhneRechnung daten={daten} onZahlung={onZahlung} onGehalten={onGehalten} onQuittung={onQuittung} /> : null}

      <Section title={vorhanden ? "Rechnung" : dieseImEntwurf ? "Rechnungsentwurf" : "Rechnungsentwurf · weitere offene Stunden"}>
        <div className="paper rounded-[14px] p-5 text-[13px]">
          <div className="flex items-start justify-between">
            <div>
              <h5 className="text-[17px] font-semibold">{vorhanden ? "Rechnung" : "Rechnung (Entwurf)"}</h5>
              <p className="text-[#777]">{vorhanden ? `Nr. ${vorhanden.number}` : "Nummer wird beim Ausstellen vergeben"}</p>
            </div>
            <p className="text-right font-bold text-[#ff7a1a]">LERNSPRUNG</p>
          </div>

          <p className="mt-3.5 text-[#444]">
            {daten.customer?.name || daten.lesson.parentName || "Rechnungsempfänger:in fehlt"}
            <br />
            {daten.customer?.street ? (
              <>
                {daten.customer.street}
                <br />
                {daten.customer.zip} {daten.customer.city}
                <br />
              </>
            ) : null}
            für {daten.lesson.studentName}
          </p>

          <table className="mt-4 w-full border-collapse">
            <thead>
              <tr>
                <th className="border-b border-[#ddd] py-1.5 text-left text-[11px] font-semibold text-[#777]">Leistung</th>
                <th className="border-b border-[#ddd] py-1.5 text-left text-[11px] font-semibold text-[#777]">Datum</th>
                <th className="border-b border-[#ddd] py-1.5 text-right text-[11px] font-semibold text-[#777]">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {(vorhanden?.lines || daten.abrechenbar || []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 text-[#666]">
                    Zurzeit ist nichts abzurechnen.
                  </td>
                </tr>
              ) : vorhanden ? (
                (vorhanden.lines || []).map((z, i) => (
                  <tr key={i}>
                    <td className="border-b border-[#eee] py-2">{z.description}</td>
                    <td className="border-b border-[#eee] py-2">{formatDate(z.date)}</td>
                    <td className="border-b border-[#eee] py-2 text-right">{formatPrice(z.totalCents ?? z.unitPriceCents)}</td>
                  </tr>
                ))
              ) : (
                daten.abrechenbar.map((z, i) => (
                  <tr key={`${z._id}-${i}`}>
                    <td className="border-b border-[#eee] py-2">{z.beschreibung}</td>
                    <td className="border-b border-[#eee] py-2">{formatDate(z.datum)}</td>
                    <td className="border-b border-[#eee] py-2 text-right">{formatPrice(z.preisCent)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="mt-3 flex justify-between text-[15px] font-bold">
            <span>Gesamt</span>
            <span>{formatPrice(vorhanden?.totalCents ?? summeCent)}</span>
          </div>

          <p className="mt-3 text-[11px] leading-snug text-[#666]">
            Gemäß § 19 UStG wird keine Umsatzsteuer berechnet. Zahlbar innerhalb von 14 Tagen per Überweisung.
          </p>
          <p className="mt-3 border-t border-dashed border-[#ccc] pt-3 text-[11px] leading-snug text-[#666]">
            <b>GiroCode:</b> Der Zahlcode mit Betrag und Verwendungszweck entsteht beim Ausstellen – dafür braucht er die
            Rechnungsnummer. Er steht dann auf dem PDF, das die Familie bekommt.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {vorhanden ? (
            <p className="text-sm text-[var(--ck-muted)]">
              Diese Stunde ist bereits abgerechnet. Ausstellen, Versand und Storno laufen über Finanzen → Rechnungen.
            </p>
          ) : (
            <>
              <Button variant="primary" onClick={onRechnung} disabled={(daten.abrechenbar || []).length === 0}>
                Entwurf anlegen und öffnen
              </Button>
            </>
          )}
        </div>
        {!vorhanden && !daten.customer?.street ? (
          <p className="mt-3 text-[13px] text-[var(--ck-warn)]">
            Für die Rechnung fehlt noch die Anschrift der Rechnungsempfängerin / des Rechnungsempfängers.
          </p>
        ) : null}
      </Section>

      {!vorhanden && !zuerstZahlung ? <OhneRechnung daten={daten} onZahlung={onZahlung} onGehalten={onGehalten} onQuittung={onQuittung} /> : null}
    </>
  );
}

// Bar (oder per Überweisung/Karte) bezahlt, ganz ohne Rechnung: Die Zahlung
// wird mit dem tatsächlichen Datum im Journal verbucht, bei Barzahlung folgt
// die Quittung. Dieselbe Buchungslogik wie in der Schülerakte
// (lib/bookkeeping/db.js recordLessonPayment) – hier nur für eine Stunde.
function OhneRechnung({ daten, onZahlung, onGehalten, onQuittung }) {
  const l = daten.lesson;
  const zahlung = daten.zahlung;
  const wegen = grundGegenAbrechnung(daten);

  // 1) Schon bezahlt: den Journaleintrag zeigen und die Quittung anbieten.
  if (zahlung) {
    const aktion = quittungAction(zahlung);
    const wie = { cash: "bar", bank: "per Überweisung", card: "per Karte" }[zahlung.method] || "";
    return (
      <Section title="Bezahlt ohne Rechnung">
        <p className="text-sm">
          {formatPrice(zahlung.amountCents)} {wie} am {formatDate(zahlung.date)} · Journal {zahlung.entryNumber}
        </p>
        {zahlung.reversedBy ? <p className="mt-2 text-sm text-[var(--ck-warn)]">Diese Buchung wurde storniert.</p> : null}
        {aktion.kind === "none" && zahlung.method === "cash" && aktion.reason ? (
          <p className="mt-2 text-[13px] text-[var(--ck-warn)]">{aktion.reason}</p>
        ) : null}
        {aktion.kind !== "none" ? (
          <div className="mt-3">
            <Button variant="primary" onClick={() => onQuittung(zahlung)}>
              {aktion.kind === "open" ? `Quittung ${aktion.number} öffnen` : "Quittung ausstellen (PDF)"}
            </Button>
          </div>
        ) : null}
      </Section>
    );
  }

  // 2) Ohne Schülerakte lässt sich nichts zuordnen.
  if (!daten.student) {
    return (
      <Section title="Ohne Rechnung bezahlt?">
        <p className="text-sm text-[var(--ck-muted)]">
          Dafür braucht die Stunde eine Schülerakte – die Zahlung wird ihr zugeordnet. Bitte erst unter „Akte“ prüfen, ob sie
          angelegt ist.
        </p>
      </Section>
    );
  }

  // 3) Abrechenbar: verbuchen.
  if (daten.abrechenbarJetzt) {
    return (
      <Section title="Ohne Rechnung bezahlt?">
        <p className="text-sm text-[var(--ck-muted)]">
          Bar, per Überweisung oder Karte – die Zahlung kommt mit dem tatsächlichen Datum ins Journal, bei Barzahlung
          kannst du danach gleich die Quittung ausstellen.
        </p>
        <div className="mt-3">
          <Button variant="primary" onClick={onZahlung}>
            Bezahlt verbuchen · {formatPrice(l.offerSnapshot?.priceCents || 0)}
          </Button>
        </div>
      </Section>
    );
  }

  // 4) Noch nicht abrechenbar: sagen, warum – und wenn es nur am Termin liegt,
  //    den kurzen Weg anbieten.
  return (
    <Section title="Ohne Rechnung bezahlt?">
      <p className="text-sm text-[var(--ck-muted)]">{wegen.text}</p>
      {wegen.holbar ? (
        <div className="mt-3">
          <Button onClick={onGehalten}>Als gehalten markieren und bezahlt verbuchen</Button>
        </div>
      ) : null}
    </Section>
  );
}

// Warum lässt sich diese Stunde (noch) nicht abrechnen? `holbar`: Es liegt nur
// daran, dass sie noch nicht als gehalten gilt.
function grundGegenAbrechnung(daten) {
  const l = daten.lesson;
  if (l.status === "pending") return { text: "Die Anfrage ist noch nicht bestätigt. Erst bestätigen, dann lässt sich die Stunde abrechnen." };
  if (l.status === "cancelled") return { text: "Der Termin ist abgesagt und wird nicht abgerechnet." };
  if (l.heldStatus === "missed" && !hatAusfallVerguetung(l)) return { text: "Die Stunde ist als ausgefallen markiert und wird nicht abgerechnet." };
  if (l.settledExternally) return { text: "Die Stunde ist bereits anderweitig abgerechnet." };
  if (l.invoiceId) return { text: "Die Stunde steht schon auf einer Rechnung." };
  return {
    text: "Die Stunde hat noch nicht stattgefunden und ist nicht als gehalten markiert – deshalb lässt sie sich noch nicht abrechnen. Wurde schon im Voraus bezahlt, kannst du sie hier als gehalten markieren.",
    holbar: l.status === "confirmed",
  };
}
