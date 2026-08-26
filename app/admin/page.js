"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";

const EMPTY_OFFER = {
  title: "",
  subject: "",
  durationLabel: "",
  description: "",
  featuresText: "",
  price: "",
  active: true,
};

const STATUS_LABEL = {
  pending: "Offen",
  paid: "Bezahlt",
  cancelled: "Storniert",
};

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
    const payload = {
      title: offerForm.title,
      subject: offerForm.subject,
      durationLabel: offerForm.durationLabel,
      description: offerForm.description,
      features: offerForm.featuresText
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean),
      priceCents: Math.round(parseFloat(offerForm.price.replace(",", ".")) * 100) || 0,
      active: offerForm.active,
    };
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
      refreshAll();
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
        <h1 className="text-xl font-bold text-slate-900">Admin-Login</h1>
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <input
            type="password"
            placeholder="PIN"
            value={loginPin}
            onChange={(e) => setLoginPin(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          {loginError ? <p className="text-sm text-red-600">{loginError}</p> : null}
          <button
            type="submit"
            className="w-full rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
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
        <h1 className="text-2xl font-bold text-slate-900">Admin-Bereich</h1>
        <button onClick={logout} className="text-sm text-slate-500 underline underline-offset-2">
          Abmelden
        </button>
      </div>

      {notice ? (
        <div className="mt-4 rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-700">{notice}</div>
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
            className={`border-b-2 px-4 py-2.5 text-sm font-medium ${
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
                className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
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
                      <p className="font-medium text-slate-900">
                        {offer.title}{" "}
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
                            price: (offer.priceCents / 100).toString(),
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
                <th className="py-2 pr-4">Klasse</th>
                <th className="py-2 pr-4">Angebot</th>
                <th className="py-2 pr-4">Erziehungsberechtigte:r</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b._id} className="border-b border-slate-100">
                  <td className="py-2.5 pr-4">{b.studentName}</td>
                  <td className="py-2.5 pr-4">{b.studentClass}</td>
                  <td className="py-2.5 pr-4">{b.offerSnapshot?.title}</td>
                  <td className="py-2.5 pr-4">
                    {b.parentName}
                    <br />
                    <span className="text-slate-500">{b.parentEmail}</span>
                  </td>
                  <td className="py-2.5 pr-4">{STATUS_LABEL[b.status] || b.status}</td>
                  <td className="py-2.5 pr-4">
                    {b.status !== "cancelled" && (
                      <button
                        onClick={() => setBookingStatus(b._id, "cancelled")}
                        className="text-red-500 hover:text-red-600"
                      >
                        Stornieren
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
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

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
      className="rounded-2xl border border-slate-200 p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-700">Titel *</label>
          <input
            required
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Fach</label>
          <input
            value={form.subject}
            onChange={(e) => update("subject", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Dauer / Laufzeit (z.B. "1 Monat")</label>
          <input
            value={form.durationLabel}
            onChange={(e) => update("durationLabel", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Preis in Euro *</label>
          <input
            required
            value={form.price}
            onChange={(e) => update("price", e.target.value)}
            placeholder="z.B. 89.00"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-slate-700">Beschreibung</label>
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-slate-700">Leistungsmerkmale (eine Zeile je Punkt)</label>
          <textarea
            value={form.featuresText}
            onChange={(e) => update("featuresText", e.target.value)}
            rows={4}
            placeholder={"4x 60 Min. pro Monat\nFlexible Terminwahl\nOnline oder vor Ort"}
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
          className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
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
  const [form, setForm] = useState(settings);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
      className="mt-8 grid gap-5 rounded-2xl border border-slate-200 p-6 sm:grid-cols-2"
    >
      <div>
        <label className="text-sm font-medium text-slate-700">Website-Name</label>
        <input
          value={form.siteName}
          onChange={(e) => update("siteName", e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700">Kontakt-E-Mail</label>
        <input
          value={form.contactEmail}
          onChange={(e) => update("contactEmail", e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-700">Slogan (große Überschrift auf der Startseite)</label>
        <input
          value={form.slogan}
          onChange={(e) => update("slogan", e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-700">Untertitel</label>
        <textarea
          value={form.subline}
          onChange={(e) => update("subline", e.target.value)}
          rows={2}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700">Kontakt-Telefon</label>
        <input
          value={form.contactPhone}
          onChange={(e) => update("contactPhone", e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Klasse ab</label>
          <input
            type="number"
            value={form.minClass}
            onChange={(e) => update("minClass", Number(e.target.value))}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Klasse bis</label>
          <input
            type="number"
            value={form.maxClass}
            onChange={(e) => update("maxClass", Number(e.target.value))}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-700">Abschnitt "{form.aboutTitle}" – Titel</label>
        <input
          value={form.aboutTitle}
          onChange={(e) => update("aboutTitle", e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-700">Abschnittstext</label>
        <textarea
          value={form.aboutText}
          onChange={(e) => update("aboutText", e.target.value)}
          rows={3}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>

      <div className="sm:col-span-2">
        <button
          type="submit"
          className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Speichern
        </button>
      </div>
    </form>
  );
}
