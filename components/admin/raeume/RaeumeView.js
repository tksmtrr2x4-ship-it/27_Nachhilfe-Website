"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import RaumUnterlagen from "@/components/admin/cockpit/RaumUnterlagen";
import Ikone from "@/components/admin/ui/Symbole";
import { Button, EmptyState, Field, Modal, errorText, formatDate, input, useDialogs } from "@/components/admin/ui";

// Freie Räume (lib/raum/raeume.js): ein Unterrichtsraum ohne Buchung – anlegen,
// Link teilen, als Host öffnen, Unterlagen bereitlegen, löschen. Gleicher Raum
// wie bei Stunden (components/raum/), nur ohne Termin und Abrechnung.

function volleAdresse(link) {
  return `${window.location.origin}${link}`;
}

export default function RaeumeView({ kopf = null }) {
  const { adminFetch, notify } = useAdmin();
  const { confirm } = useDialogs();
  const [raeume, setRaeume] = useState(null);
  const [neu, setNeu] = useState(null); // { titel, gastName } beim Anlegen
  const [frisch, setFrisch] = useState(null); // gerade angelegter Raum
  const [unterlagenFuer, setUnterlagenFuer] = useState(null);
  const [laeuft, setLaeuft] = useState(false);

  const laden = useCallback(async () => {
    try {
      setRaeume((await adminFetch("/api/admin/raeume")).raeume);
    } catch (err) {
      notify(errorText(err));
    }
  }, [adminFetch, notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  async function anlegen(e) {
    e.preventDefault();
    setLaeuft(true);
    try {
      const { raum } = await adminFetch("/api/admin/raeume", { method: "POST", body: JSON.stringify(neu) });
      setNeu(null);
      setFrisch(raum);
      laden();
    } catch (err) {
      notify(errorText(err));
    } finally {
      setLaeuft(false);
    }
  }

  async function kopieren(r) {
    try {
      await navigator.clipboard.writeText(volleAdresse(r.link));
      notify("Link kopiert.");
    } catch {
      notify(volleAdresse(r.link));
    }
  }

  async function teilen(r) {
    try {
      await navigator.share({ title: r.titel, text: "Link zum Lernsprung-Unterrichtsraum", url: volleAdresse(r.link) });
    } catch (err) {
      if (err?.name !== "AbortError") kopieren(r);
    }
  }

  async function oeffnen(r) {
    // Fenster sofort öffnen (sonst blockt Safari es nach dem Warten).
    const fenster = window.open("", "_blank");
    try {
      const t = await adminFetch("/api/admin/raum", { method: "POST", body: JSON.stringify({ raumId: r.id, wiederOeffnen: true }) });
      const ziel = `${volleAdresse(t.link)}#host=${t.ticket}`;
      if (fenster) fenster.location.href = ziel;
      else window.open(ziel, "_self");
      if (r.geschlossen) laden();
    } catch (err) {
      fenster?.close();
      notify(errorText(err));
    }
  }

  async function loeschen(r) {
    const ok = await confirm({
      title: "Raum löschen?",
      message: `„${r.titel}“ und seine Unterlagen werden gelöscht. Der Link funktioniert danach nicht mehr.`,
      confirmLabel: "Löschen",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminFetch(`/api/admin/raeume?id=${encodeURIComponent(r.id)}`, { method: "DELETE" });
      notify("Raum gelöscht.");
      laden();
    } catch (err) {
      notify(errorText(err));
    }
  }

  // Teilen-Menü nur auf Touch-Geräten – am Mac blieb es hängen; dort kopieren.
  const kannTeilen =
    typeof navigator !== "undefined" && typeof navigator.share === "function" && window.matchMedia?.("(pointer: coarse)").matches;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {kopf}
        <Button variant="primary" onClick={() => setNeu({ titel: "", gastName: "" })}>
          Neuer Raum
        </Button>
      </div>

      {raeume === null ? (
        <p className="text-sm text-[var(--ck-muted)]">Lädt …</p>
      ) : raeume.length === 0 ? (
        <div className="ck-glas rounded-[var(--ck-r)] p-6">
          <EmptyState
            title="Noch keine freien Räume"
            hint="Ein freier Raum gehört zu keiner Stunde – zum Kennenlernen, für eine kurze Besprechung oder spontan. Link teilen, fertig."
          >
            <Button variant="primary" onClick={() => setNeu({ titel: "", gastName: "" })}>
              Raum anlegen
            </Button>
          </EmptyState>
        </div>
      ) : (
        <ul className="ck-glas overflow-hidden rounded-[var(--ck-r)] [&>li+li]:border-t [&>li+li]:border-[var(--ck-line)]">
          {raeume.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:flex-nowrap">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[var(--ck-accent)] text-white">
                <Ikone name="raum" className="h-5 w-5" strich={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{r.titel}</p>
                <p className="truncate text-[12.5px] text-[var(--ck-muted)]">
                  {[r.gastName || null, `angelegt ${formatDate(r.erstelltAm.slice(0, 10))}`, r.geschlossen ? "geschlossen" : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:flex-nowrap">
                <Button variant="primary" onClick={() => oeffnen(r)}>
                  Öffnen
                </Button>
                <Button onClick={() => (kannTeilen ? teilen(r) : kopieren(r))}>{kannTeilen ? "Teilen" : "Link kopieren"}</Button>
                <Button variant="ghost" onClick={() => setUnterlagenFuer(r)}>
                  Unterlagen
                </Button>
                <button
                  type="button"
                  onClick={() => loeschen(r)}
                  aria-label={`${r.titel} löschen`}
                  className="grid h-9 w-9 place-items-center rounded-full text-[var(--ck-neg)] transition hover:bg-[var(--ck-neg-soft)]"
                >
                  <Ikone name="papierkorb" className="h-[18px] w-[18px]" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {neu ? (
        <Modal title="Neuer Raum" onClose={() => setNeu(null)}>
          <form onSubmit={anlegen} className="space-y-4">
            <Field label="Name des Raums">
              <input
                className={input}
                value={neu.titel}
                onChange={(e) => setNeu((n) => ({ ...n, titel: e.target.value }))}
                placeholder="z. B. Kennenlernen Familie Müller"
                maxLength={80}
                autoFocus
                required
              />
            </Field>
            <Field label="Gast (optional)">
              <input
                className={input}
                value={neu.gastName}
                onChange={(e) => setNeu((n) => ({ ...n, gastName: e.target.value }))}
                placeholder="z. B. Mila"
                maxLength={60}
              />
            </Field>
            <p className="text-[13px] text-[var(--ck-muted)]">
              Wer den Link hat, kommt als Gast hinein. Du öffnest den Raum hier als Host. Am Ende „Stunde beenden“ – dann ist er zu, bis du ihn
              wieder öffnest.
            </p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setNeu(null)}>Abbrechen</Button>
              <Button variant="primary" type="submit" busy={laeuft}>
                Anlegen
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {frisch ? (
        <Modal title="Raum ist bereit" onClose={() => setFrisch(null)}>
          <p className="text-[15px] font-semibold">{frisch.titel}</p>
          <p className="mt-2 break-all rounded-[12px] bg-[var(--ck-surface2)] px-3.5 py-2.5 text-[14px]">{volleAdresse(frisch.link)}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {kannTeilen ? (
              <Button onClick={() => teilen(frisch)}>Teilen</Button>
            ) : (
              <Button onClick={() => kopieren(frisch)}>Link kopieren</Button>
            )}
            <Button
              variant="primary"
              onClick={() => {
                oeffnen(frisch);
                setFrisch(null);
              }}
            >
              Raum öffnen
            </Button>
          </div>
        </Modal>
      ) : null}

      {unterlagenFuer ? (
        <Modal title={`Unterlagen · ${unterlagenFuer.titel}`} onClose={() => setUnterlagenFuer(null)}>
          <RaumUnterlagen
            booking={{ _id: unterlagenFuer.id, meetingToken: unterlagenFuer.token }}
            raumHolen={() => adminFetch("/api/admin/raum", { method: "POST", body: JSON.stringify({ raumId: unterlagenFuer.id }) })}
            confirm={confirm}
          />
        </Modal>
      ) : null}
    </div>
  );
}
