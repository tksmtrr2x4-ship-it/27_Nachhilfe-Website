"use client";

import { useEffect, useState } from "react";
import { formatPrice, formatDate, locationLabel } from "@/lib/format";
import { computeSavings, computeTotalHours } from "@/lib/pricing";

const EMPTY_OFFER = {
  type: "package",
  title: "",
  subject: "",
  durationLabel: "",
  durationMinutes: "45",
  sessionCount: "",
  sessionMinutes: "45",
  weeks: "",
  mode: "both",
  catchmentAreaText: "Villingen-Schwenningen und Umgebung (15 km)",
  cancellationText: "Kostenlose Stornierung bis 24 Stunden vor dem Termin.",
  validityText: "",
  description: "",
  featuresText: "",
  price: "",
  listPrice: "",
  active: true,
};

const STATUS_LABEL = {
  pending: "Offen",
  confirmed: "Bestätigt",
  paid: "Bezahlt",
  cancelled: "Storniert",
};

const MODE_OPTIONS = [
  ["both", "Online oder vor Ort"],
  ["presence", "Nur vor Ort"],
  ["online", "Nur online"],
];

export default function AdminPage() {
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loginPin, setLoginPin] = useState("");
  const [loginError, setLoginError] = useState("");

  const [tab, setTab] = useState("offers");
  const [offers, setOffers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [settings, setSettings] = useState(null);
  const [editingOffer, setEditingOffer] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem("admin_pin") : null;
    if (stored) {
      setPin(stored);
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (authed) refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  async function adminFetch(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-admin-pin": pin,
        ...(options.headers || {}),
      },
    });
    if (res.status === 403) {
      setAuthed(false);
      sessionStorage.removeItem("admin_pin");
      throw new Error("Sitzung abgelaufen, bitte erneut anmelden.");
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Fehler");
    return data;
  }

  async function refreshAll() {
    try {
      const [o, b, s] = await Promise.all([
        adminFetch("/api/admin/offers"),
        adminFetch("/api/admin/bookings"),
        adminFetch("/api/admin/settings"),
      ]);
      setOffers(o.offers);
      setBookings(b.bookings);
      setSettings(s.settings);
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: loginPin }),
    });
    const data = await res.json();
    if (data.ok) {
      sessionStorage.setItem("admin_pin", loginPin);
      setPin(loginPin);
      setAuthed(true);
    } else {
      setLoginError("Falscher PIN.");
    }
  }

  function logout() {
    sessionStorage.removeItem("admin_pin");
    setAuthed(false);
    setPin("");
  }

  async function saveOffer(offerForm, id) {
    const isSession = offerForm.type === "session";
    const payload = {
      type: offerForm.type,
      title: offerForm.title,
      subject: offerForm.subject,
      mode: offerForm.mode,
      catchmentAreaText: offerForm.catchmentAreaText,
      cancellationText: offerForm.cancellationText,
      validityText: offerForm.validityText,
      description: offerForm.description,
      features: offerForm.featuresText
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean),
      priceCents: Math.round(parseFloat(offerForm.price.replace(",", ".")) * 100) || 0,
      listPriceCents: offerForm.listPrice.trim()
        ? Math.round(parseFloat(offerForm.listPrice.replace(",", ".")) * 100) || null
        : null,
      active: offerForm.active,
    };

    if (isSession) {
      payload.durationMinutes = Number(offerForm.durationMinutes) || 45;
      payload.durationLabel =
        offerForm.durationMinutes === "90" ? "90 Minuten (Doppelstunde)" : "45 Minuten";
      payload.sessionCount = null;
      payload.sessionMinutes = null;
      payload.weeks = null;
    } else {
      payload.durationMinutes = null;
      payload.sessionCount = Number(offerForm.sessionCount) || null;
      payload.sessionMinutes = Number(offerForm.sessionMinutes) || null;
      payload.weeks = Number(offerForm.weeks) || null;
      // durationLabel wird bei Paketen aus den strukturierten Feldern
      // angezeigt (lib/pricing.js) – der freie Text bleibt nur als Fallback
      // für ältere Angebote ohne diese Felder erhalten.
      payload.durationLabel = offerForm.durationLabel;
    }

    try {
      if (id) {
        await adminFetch(`/api/admin/offers/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await adminFetch("/api/admin/offers", { method: "POST", body: JSON.stringify(payload) });
      }
      setEditingOffer(null);
      setNotice("Angebot gespeichert.");
      refreshAll();
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function toggleActive(offer) {
    try {
      await adminFetch(`/api/admin/offers/${offer._id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !offer.active }),
      });
      refreshAll();
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function deleteOfferItem(id) {
    if (!confirm("Angebot wirklich löschen?")) return;
    try {
      await adminFetch(`/api/admin/offers/${id}`, { method: "DELETE" });
      refreshAll();
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function setBookingStatus(id, status) {
    try {
      await adminFetch(`/api/admin/bookings/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setNotice(status === "confirmed" ? "Termin bestätigt, Kunde wurde per Mail informiert." : "Status aktualisiert.");
      refreshAll();
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function resendConfirmation(id) {
    try {
      await adminFetch(`/api/admin/bookings/${id}`, { method: "POST" });
      setNotice("Bestätigungsmail erneut gesendet.");
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function saveSettings(patch) {
    try {
      const data = await adminFetch("/api/admin/settings", { method: "PATCH", body: JSON.stringify(patch) });
      setSettings(data.settings);
      setNotice("Einstellungen gespeichert.");
    } catch (err) {
      setNotice(err.message);
    }
  }

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-6">
        <h1 className="text-xl font-semibold text-slate-900">Admin-Login</h1>
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <label htmlFor="admin-pin" className="sr-only">
            PIN
          </label>
          <input
            id="admin-pin"
            type="password"
            placeholder="PIN"
            value={loginPin}
            onChange={(e) => setLoginPin(e.target.value)}
            aria-describedby={loginError ? "admin-pin-error" : undefined}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          {loginError ? (
            <p id="admin-pin-error" role="alert" className="text-sm text-red-600">
              {loginError}
            </p>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Anmelden
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Admin-Bereich</h1>
        <button onClick={logout} className="text-sm text-slate-500 underline underline-offset-2">
          Abmelden
        </button>
      </div>

      {notice ? (
        <div role="status" className="mt-4 rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-700">
          {notice}
        </div>
      ) : null}

      <div className="mt-6 flex gap-2 border-b border-slate-200">
        {[
          ["offers", "Angebote"],
          ["bookings", "Buchungen"],
          ["settings", "Einstellungen"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold ${
              tab === key ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "offers" && (
        <div className="mt-8">
          {editingOffer ? (
            <OfferForm
              initial={editingOffer === "new" ? EMPTY_OFFER : editingOffer}
              onCancel={() => setEditingOffer(null)}
              onSave={(form) => saveOffer(form, editingOffer === "new" ? null : editingOffer._id)}
            />
          ) : (
            <>
              <button
                onClick={() => setEditingOffer("new")}
                className="rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                + Neues Angebot
              </button>
              <div className="mt-6 space-y-3">
                {offers.map((offer) => (
                  <div
                    key={offer._id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {offer.title}{" "}
                        <span className="ml-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">
                          {offer.type === "session" ? "Einzelstunde" : "Paket"}
                        </span>{" "}
                        {!offer.active && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                            inaktiv
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-slate-500">
                        {offer.subject} · {offer.durationLabel} · {formatPrice(offer.priceCents)}
                      </p>
                    </div>
                    <div className="flex gap-3 text-sm">
                      <button onClick={() => toggleActive(offer)} className="text-slate-500 hover:text-indigo-600">
                        {offer.active ? "Deaktivieren" : "Aktivieren"}
                      </button>
                      <button
                        onClick={() =>
                          setEditingOffer({
                            ...offer,
                            type: offer.type || "package",
                            durationMinutes: offer.durationMinutes ? String(offer.durationMinutes) : "45",
                            sessionCount: offer.sessionCount ? String(offer.sessionCount) : "",
                            sessionMinutes: offer.sessionMinutes ? String(offer.sessionMinutes) : "45",
                            weeks: offer.weeks ? String(offer.weeks) : "",
                            mode: offer.mode || "both",
                            catchmentAreaText: offer.catchmentAreaText || "",
                            cancellationText: offer.cancellationText || "",
                            validityText: offer.validityText || "",
                            price: (offer.priceCents / 100).toString(),
                            listPrice: offer.listPriceCents ? (offer.listPriceCents / 100).toString() : "",
                            featuresText: (offer.features || []).join("\n"),
                          })
                        }
                        className="text-slate-500 hover:text-indigo-600"
                      >
                        Bearbeiten
                      </button>
                      <button onClick={() => deleteOfferItem(offer._id)} className="text-red-500 hover:text-red-600">
                        Löschen
                      </button>
                    </div>
                  </div>
                ))}
                {offers.length === 0 && <p className="text-sm text-slate-500">Noch keine Angebote angelegt.</p>}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "bookings" && (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-2 pr-4">Schüler:in</th>
                <th className="py-2 pr-4">Klasse / Fach</th>
                <th className="py-2 pr-4">Angebot</th>
                <th className="py-2 pr-4">Termin / Ort</th>
                <th className="py-2 pr-4">Erziehungsberechtigte:r</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const isSession = b.offerSnapshot?.type === "session";
                return (
                  <tr key={b._id} className="border-b border-slate-100 align-top">
                    <td className="py-2.5 pr-4">{b.studentName}</td>
                    <td className="py-2.5 pr-4">
                      {b.studentClass}
                      {b.subject ? <span className="text-slate-500"> · {b.subject}</span> : null}
                    </td>
                    <td className="py-2.5 pr-4">{b.offerSnapshot?.title}</td>
                    <td className="py-2.5 pr-4">
                      {isSession ? (
                        <>
                          {formatDate(b.requestedDate)} · {b.requestedTime} Uhr
                          <br />
                          <span className="text-slate-500">{locationLabel(b)}</span>
                        </>
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      {b.parentName}
                      <br />
                      <span className="text-slate-500">{b.parentEmail}</span>
                    </td>
                    <td className="py-2.5 pr-4">{STATUS_LABEL[b.status] || b.status}</td>
                    <td className="py-2.5 pr-4">
                      <div className="flex flex-col items-start gap-1">
                        {isSession && b.status === "pending" && (
                          <button
                            onClick={() => setBookingStatus(b._id, "confirmed")}
                            className="text-emerald-600 hover:text-emerald-700"
                          >
                            Bestätigen
                          </button>
                        )}
                        {isSession && b.status === "confirmed" && (
                          <button
                            onClick={() => resendConfirmation(b._id)}
                            className="text-slate-500 hover:text-indigo-600"
                          >
                            Mail erneut senden
                          </button>
                        )}
                        {isSession && b.status !== "cancelled" && (
                          <a
                            href={`mailto:${b.parentEmail}?subject=${encodeURIComponent(
                              `Deine Terminanfrage – ${b.offerSnapshot?.title}`
                            )}`}
                            className="text-slate-500 hover:text-indigo-600"
                          >
                            Kontaktieren
                          </a>
                        )}
                        {b.status !== "cancelled" && (
                          <button
                            onClick={() => setBookingStatus(b._id, "cancelled")}
                            className="text-red-500 hover:text-red-600"
                          >
                            Stornieren
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    Noch keine Buchungen.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "settings" && settings && (
        <SettingsForm settings={settings} onSave={saveSettings} />
      )}
    </div>
  );
}

function OfferForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(initial);
  const isSession = form.type === "session";

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const priceCents = Math.round(parseFloat((form.price || "0").replace(",", ".")) * 100) || 0;
  const listPriceCents = form.listPrice.trim()
    ? Math.round(parseFloat(form.listPrice.replace(",", ".")) * 100) || null
    : null;
  const savings = computeSavings(listPriceCents, priceCents);
  const totalHours = computeTotalHours(Number(form.sessionCount), Number(form.sessionMinutes));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
      className="rounded-2xl border border-slate-200 p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-sm font-semibold text-slate-700">Art des Angebots</label>
          <div className="mt-1.5 flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={!isSession}
                onChange={() => update("type", "package")}
                className="h-4 w-4 text-indigo-600"
              />
              Paket (z.B. Kursabo)
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={isSession}
                onChange={() => update("type", "session")}
                className="h-4 w-4 text-indigo-600"
              />
              Einzelstunde (Kunde wählt Termin)
            </label>
          </div>
        </div>
        <div>
          <label htmlFor="offer-title" className="text-sm font-semibold text-slate-700">
            Titel *
          </label>
          <input
            id="offer-title"
            required
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="offer-subject" className="text-sm font-semibold text-slate-700">
            Fach/Fächer (mit „ | " trennen)
          </label>
          <input
            id="offer-subject"
            value={form.subject}
            onChange={(e) => update("subject", e.target.value)}
            placeholder="Mathematik | Physik"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>

        {isSession ? (
          <div>
            <label htmlFor="offer-duration-minutes" className="text-sm font-semibold text-slate-700">
              Dauer
            </label>
            <select
              id="offer-duration-minutes"
              value={form.durationMinutes || "45"}
              onChange={(e) => update("durationMinutes", e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
            >
              <option value="45">45 Minuten</option>
              <option value="90">90 Minuten (Doppelstunde)</option>
            </select>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="offer-session-count" className="text-sm font-semibold text-slate-700">
                Anzahl Einheiten *
              </label>
              <input
                id="offer-session-count"
                required
                type="number"
                min={1}
                value={form.sessionCount}
                onChange={(e) => update("sessionCount", e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="offer-session-minutes" className="text-sm font-semibold text-slate-700">
                Minuten je Einheit *
              </label>
              <select
                id="offer-session-minutes"
                value={form.sessionMinutes || "45"}
                onChange={(e) => update("sessionMinutes", e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
              >
                <option value="45">45 Minuten</option>
                <option value="90">90 Minuten</option>
              </select>
            </div>
            <div>
              <label htmlFor="offer-weeks" className="text-sm font-semibold text-slate-700">
                Laufzeit in Wochen (leer lassen bei Tages-Intensivpaketen)
              </label>
              <input
                id="offer-weeks"
                type="number"
                min={0}
                value={form.weeks}
                onChange={(e) => update("weeks", e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
              />
            </div>
          </>
        )}

        <div>
          <label htmlFor="offer-price" className="text-sm font-semibold text-slate-700">
            Preis in Euro *
          </label>
          <input
            id="offer-price"
            required
            value={form.price}
            onChange={(e) => update("price", e.target.value)}
            placeholder="z.B. 89.00"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="offer-list-price" className="text-sm font-semibold text-slate-700">
            Streichpreis in Euro (optional, für Rabatt-Badge)
          </label>
          <input
            id="offer-list-price"
            value={form.listPrice}
            onChange={(e) => update("listPrice", e.target.value)}
            placeholder="leer lassen = kein Badge"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>

        {!isSession && form.sessionCount && totalHours ? (
          <p className="sm:col-span-2 text-xs text-slate-500">Gesamt: {totalHours} Stunden.</p>
        ) : null}
        {form.listPrice.trim() ? (
          <div className="sm:col-span-2 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            {savings ? (
              <>
                Ersparnis: {formatPrice(savings.savingCents)} ({savings.percent} %) – wird als
                Badge auf der Karte angezeigt.
              </>
            ) : (
              "Kein Rabatt-Badge (Streichpreis liegt nicht über dem Preis)."
            )}
          </div>
        ) : null}

        <div>
          <label htmlFor="offer-mode" className="text-sm font-semibold text-slate-700">
            Online/Präsenz
          </label>
          <select
            id="offer-mode"
            value={form.mode}
            onChange={(e) => update("mode", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          >
            {MODE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="offer-catchment" className="text-sm font-semibold text-slate-700">
            Einzugsgebiet (bei Präsenz)
          </label>
          <input
            id="offer-catchment"
            value={form.catchmentAreaText}
            onChange={(e) => update("catchmentAreaText", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="offer-cancellation" className="text-sm font-semibold text-slate-700">
            Stornofrist
          </label>
          <input
            id="offer-cancellation"
            value={form.cancellationText}
            onChange={(e) => update("cancellationText", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="offer-validity" className="text-sm font-semibold text-slate-700">
            Gültigkeitsdauer des Pakets
          </label>
          <input
            id="offer-validity"
            value={form.validityText}
            onChange={(e) => update("validityText", e.target.value)}
            placeholder="z.B. 6 Wochen ab Buchung einzulösen"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="offer-description" className="text-sm font-semibold text-slate-700">
            Beschreibung
          </label>
          <textarea
            id="offer-description"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="offer-features" className="text-sm font-semibold text-slate-700">
            Leistungsmerkmale (eine Zeile je Punkt, keine Rabatt-Texte – die kommen automatisch als Badge)
          </label>
          <textarea
            id="offer-features"
            value={form.featuresText}
            onChange={(e) => update("featuresText", e.target.value)}
            rows={4}
            placeholder={"Übungsblätter inklusive\nFlexible Terminwahl"}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => update("active", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          Sofort sichtbar (aktiv)
        </label>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Speichern
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-500">
          Abbrechen
        </button>
      </div>
    </form>
  );
}

function SettingsForm({ settings, onSave }) {
  const [form, setForm] = useState({
    ...settings,
    aboutBulletsText: (settings.aboutBullets || []).join("\n"),
  });

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const { aboutBulletsText, ...rest } = form;
    onSave({
      ...rest,
      aboutBullets: aboutBulletsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 grid gap-5 rounded-2xl border border-slate-200 p-6 sm:grid-cols-2"
    >
      <div>
        <label htmlFor="s-siteName" className="text-sm font-semibold text-slate-700">
          Website-Name
        </label>
        <input
          id="s-siteName"
          value={form.siteName}
          onChange={(e) => update("siteName", e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="s-contactEmail" className="text-sm font-semibold text-slate-700">
          Kontakt-E-Mail
        </label>
        <input
          id="s-contactEmail"
          value={form.contactEmail}
          onChange={(e) => update("contactEmail", e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="s-slogan" className="text-sm font-semibold text-slate-700">
          Slogan (große Überschrift auf der Startseite)
        </label>
        <input
          id="s-slogan"
          value={form.slogan}
          onChange={(e) => update("slogan", e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="s-subline" className="text-sm font-semibold text-slate-700">
          Untertitel
        </label>
        <textarea
          id="s-subline"
          value={form.subline}
          onChange={(e) => update("subline", e.target.value)}
          rows={2}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="s-contactPhone" className="text-sm font-semibold text-slate-700">
          Kontakt-Telefon
        </label>
        <input
          id="s-contactPhone"
          value={form.contactPhone}
          onChange={(e) => update("contactPhone", e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="s-minClass" className="text-sm font-semibold text-slate-700">
            Klasse ab
          </label>
          <input
            id="s-minClass"
            type="number"
            value={form.minClass}
            onChange={(e) => update("minClass", Number(e.target.value))}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="s-maxClass" className="text-sm font-semibold text-slate-700">
            Klasse bis
          </label>
          <input
            id="s-maxClass"
            type="number"
            value={form.maxClass}
            onChange={(e) => update("maxClass", Number(e.target.value))}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="s-tutorAddress" className="text-sm font-semibold text-slate-700">
          Deine Adresse (für Einzelstunden "bei der Lehrkraft" und Impressum/Schema.org)
        </label>
        <input
          id="s-tutorAddress"
          value={form.tutorAddress}
          onChange={(e) => update("tutorAddress", e.target.value)}
          placeholder="Straße Hausnummer, PLZ Ort"
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="s-hourStart" className="text-sm font-semibold text-slate-700">
            Termine buchbar ab (Uhrzeit, Mo-Fr)
          </label>
          <input
            id="s-hourStart"
            type="number"
            min={0}
            max={23}
            value={form.bookingHourStart}
            onChange={(e) => update("bookingHourStart", Number(e.target.value))}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="s-hourEnd" className="text-sm font-semibold text-slate-700">
            Termine buchbar bis (Uhrzeit, Mo-Fr)
          </label>
          <input
            id="s-hourEnd"
            type="number"
            min={1}
            max={24}
            value={form.bookingHourEnd}
            onChange={(e) => update("bookingHourEnd", Number(e.target.value))}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
      </div>
      <p className="sm:col-span-2 -mt-3 text-xs text-slate-500">
        Samstags gilt automatisch ein kürzeres Fenster (10–16 Uhr), sonntags sind keine Termine
        buchbar.
      </p>

      <div className="sm:col-span-2 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4">
        <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.kleinunternehmer}
            onChange={(e) => update("kleinunternehmer", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          Kleinunternehmer nach § 19 UStG (keine USt. ausgewiesen)
        </label>
        {!form.kleinunternehmer && (
          <div className="col-span-2">
            <label htmlFor="s-ustId" className="text-sm font-semibold text-slate-700">
              USt-IdNr.
            </label>
            <input
              id="s-ustId"
              value={form.ustId}
              onChange={(e) => update("ustId", e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
            />
          </div>
        )}
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="s-aboutTitle" className="text-sm font-semibold text-slate-700">
          Abschnitt "Warum Lernsprung" – Titel
        </label>
        <input
          id="s-aboutTitle"
          value={form.aboutTitle}
          onChange={(e) => update("aboutTitle", e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="s-aboutText" className="text-sm font-semibold text-slate-700">
          Einleitung (max. ca. 90 Wörter)
        </label>
        <textarea
          id="s-aboutText"
          value={form.aboutText}
          onChange={(e) => update("aboutText", e.target.value)}
          rows={3}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="s-aboutBullets" className="text-sm font-semibold text-slate-700">
          Stichpunkte (eine Zeile je Punkt, max. 3)
        </label>
        <textarea
          id="s-aboutBullets"
          value={form.aboutBulletsText}
          onChange={(e) => update("aboutBulletsText", e.target.value)}
          rows={3}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>

      <div className="sm:col-span-2">
        <button
          type="submit"
          className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Speichern
        </button>
      </div>
    </form>
  );
}
