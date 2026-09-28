"use client";

import { useCallback, useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { Badge, Button, DataTable, Toolbar, errorText, formatDateTime, input, label as labelClass, useDialogs } from "@/components/admin/ui";

// Zugang: Passkeys einrichten und entfernen.
//
// Ein Passkey ist entweder gerätegebunden (Face ID auf dem iPhone, Touch ID am
// Mac) oder steckbar (FIDO2-USB-Schlüssel). Der private Teil verlässt das
// Gerät nie; auf dem Server liegt nur der öffentliche Teil.
//
// Dazu zeigt die Seite, ob an neuen Geräten noch per Mail bestätigt werden muss
// (siehe lib/auth/loginMail.js).
export default function ZugangView() {
  const { adminFetch, notify } = useAdmin();
  const { confirm } = useDialogs();
  const [passkeys, setPasskeys] = useState([]);
  const [mail, setMail] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await adminFetch("/api/admin/passkeys");
      setPasskeys(data.passkeys);
      setMail(data.mail || null);
    } catch (err) {
      notify(errorText(err));
    } finally {
      setLoaded(true);
    }
  }, [adminFetch, notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // art: "geraet" = Face ID / Touch ID, "stick" = USB-Sicherheitsschlüssel.
  async function addPasskey(e, art) {
    e.preventDefault();
    setBusy(art);
    try {
      const start = await adminFetch(`/api/admin/passkeys${art === "stick" ? "?art=stick" : ""}`, { method: "PUT" });
      let response;
      try {
        response = await startRegistration({ optionsJSON: start.options });
      } catch (err) {
        notify(anmeldeFehler(err, art));
        return;
      }
      await adminFetch("/api/admin/passkeys", {
        method: "POST",
        body: JSON.stringify({
          challengeId: start.challengeId,
          response,
          art,
          label: label || (art === "stick" ? "Sicherheitsschlüssel" : "Neuer Passkey"),
        }),
      });
      notify("Passkey eingerichtet.");
      setLabel("");
      load();
    } catch (err) {
      notify(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  // Apple und Google legen pro Konto nur einen Passkey je Adresse an. Wer es
  // auf einem zweiten Gerät derselben Wolke versucht, bekommt deshalb einen
  // Fehler, der nach einem Defekt aussieht, aber keiner ist.
  function anmeldeFehler(err, art) {
    if (err?.name === "InvalidStateError") {
      return art === "stick"
        ? "Auf diesem Sicherheitsschlüssel liegt bereits ein Passkey für diese Seite."
        : "Dieses Konto hat hier schon einen Passkey. Apple und Google legen pro Konto nur einen je Adresse an und spiegeln ihn auf alle Geräte – auf dem iPhone ist er also längst vorhanden. Für einen wirklich zweiten Schlüssel den Weg über den Sicherheitsschlüssel wählen.";
    }
    if (err?.name === "NotAllowedError") return "Abgebrochen oder zu lange gewartet.";
    return `Nicht möglich: ${err.message}`;
  }

  async function remove(passkey) {
    const last = passkeys.length <= 1;
    const ok = await confirm({
      title: `Passkey „${passkey.label}" entfernen?`,
      message: last
        ? "Das ist der letzte Passkey. Danach genügt zur Anmeldung wieder der PIN allein, und alle bekannten Geräte werden vergessen."
        : "Dieses Gerät kann sich danach nicht mehr anmelden.",
      confirmLabel: "Entfernen",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminFetch(`/api/admin/passkeys/${passkey._id}`, { method: "DELETE" });
      notify("Passkey entfernt.");
      load();
    } catch (err) {
      notify(errorText(err));
    }
  }

  return (
    <div className="space-y-5">
      <Toolbar
        title="Zugang"
        hint="An bekannten Geräten genügt Face ID oder Touch ID. An neuen Geräten kommen PIN und der Bestätigungslink per Mail dazu."
      />

      <div
        className={`rounded-2xl border p-4 text-sm ${
          passkeys.length > 1
            ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
            : passkeys.length === 1 || mail?.aktiv
              ? "border-amber-200 bg-amber-50/70 text-amber-900"
              : "border-red-200 bg-red-50/70 text-red-900"
        }`}
      >
        {passkeys.length === 0
          ? mail?.aktiv
            ? `Kein Passkey hinterlegt: Die Anmeldung läuft über PIN und den Bestätigungslink an ${mail.adresse}. Das sind zwei Schritte – ein Passkey ist trotzdem deutlich stärker, weil er nicht abgetippt werden kann.`
            : "Zurzeit nur ein Faktor: Es ist kein Passkey hinterlegt, die Anmeldung läuft allein über den PIN."
          : passkeys.length === 1
            ? passkeys[0].kind === "geräteübergreifend"
              ? "Ein Passkey hinterlegt, und zwar im Schlüsselbund deines Apple- bzw. Google-Kontos: Er gilt bereits auf allen Geräten dieses Kontos, auch auf dem iPhone. Ein zweiter per Face ID lässt sich deshalb nicht anlegen – eine echte Reserve wird es erst mit einem USB-Sicherheitsschlüssel, der unabhängig vom Konto funktioniert."
              : "Ein Passkey hinterlegt, und der gilt nur auf diesem einen Gerät. Richte einen zweiten ein – sonst sperrst du dich aus, wenn das Gerät verloren geht."
            : `${passkeys.length} Passkeys hinterlegt, davon einer als Reserve. Gut so.`}
      </div>

      <form
        onSubmit={(e) => addPasskey(e, "geraet")}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <label className="block min-w-48 flex-1">
          <span className={labelClass}>Bezeichnung</span>
          <input
            className={input}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="z. B. MacBook, iPhone, USB-Schlüssel"
            maxLength={80}
          />
        </label>
        <Button type="submit" variant="primary" busy={busy === "geraet"} busyLabel="Wartet auf Bestätigung …">
          Face ID / Touch ID
        </Button>
        <Button
          type="button"
          onClick={(e) => addPasskey(e, "stick")}
          busy={busy === "stick"}
          busyLabel="Schlüssel antippen …"
        >
          Sicherheitsschlüssel
        </Button>
      </form>

      <p className="text-xs text-slate-500">
        „Face ID / Touch ID“ legt den Passkey im Schlüsselbund deines Apple- oder Google-Kontos ab –
        von dort gilt er auf allen Geräten dieses Kontos, ein zweiter geht dann nicht mehr.
        „Sicherheitsschlüssel“ fragt gezielt nach einem Stick: einstecken, tippen, fertig. Nötig ist
        ein FIDO2-Schlüssel (YubiKey o. ä.); ein gewöhnlicher USB-Speicherstick funktioniert nicht,
        weil kein Browser Dateien von einem Stick als Anmeldung lesen darf.
      </p>

      <p className="text-xs text-slate-500">
        {mail?.aktiv
          ? `Anmeldungen an neuen Geräten werden zusätzlich per Mail an ${mail.adresse} bestätigt. Bekannte Geräte brauchen das nicht. Kommt keine Mail an, lässt sich der Schritt auf dem Server mit ADMIN_LOGIN_MAIL=aus abschalten.`
          : "Der Bestätigungslink per Mail ist abgeschaltet – es fehlt entweder das Postfach (ADMIN_LOGIN_MAIL) oder der Mailversand (SMTP)."}
      </p>

      <DataTable
        rows={passkeys}
        getRowKey={(p) => p._id}
        empty={loaded ? "Noch kein Passkey eingerichtet." : "Lädt …"}
        columns={[
          {
            key: "label",
            header: "Passkey",
            priority: "primary",
            cell: (p) => (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900 dark:text-white">{p.label}</span>
                <Badge tone={p.kind === "geräteübergreifend" ? "sky" : "slate"}>{p.kind}</Badge>
              </span>
            ),
          },
          { key: "createdAt", header: "Eingerichtet", width: "12rem", cell: (p) => formatDateTime(p.createdAt) },
          {
            key: "lastUsedAt",
            header: "Zuletzt benutzt",
            width: "12rem",
            cell: (p) => (p.lastUsedAt ? formatDateTime(p.lastUsedAt) : "–"),
          },
        ]}
        actions={(p) => [{ label: "Entfernen", tone: "red", onClick: () => remove(p) }]}
      />

      <p className="text-xs text-slate-500">
        Kommst du gar nicht mehr hinein, lässt sich auf dem Server mit{" "}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">npm run zugang:zuruecksetzen</code> auf
        reine PIN-Anmeldung zurückschalten.
      </p>
    </div>
  );
}
