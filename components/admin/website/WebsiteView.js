"use client";

import { useCallback, useEffect, useState } from "react";
import { formatClassRange } from "@/lib/pricing";
import { SUB_VIEWS, subViewFrom } from "@/lib/admin/nav";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { Badge, Button, DataTable, Toolbar, formatPrice, useDialogs } from "@/components/admin/ui";
import OfferForm, { EMPTY_OFFER } from "@/components/admin/website/OfferForm";
import TestimonialForm, { EMPTY_TESTIMONIAL } from "@/components/admin/website/TestimonialForm";
import SettingsForm from "@/components/admin/website/SettingsForm";

// Bereich "Website": Angebote, Rückmeldungen und die Website-Einstellungen.
// Alles, was Besucher:innen sehen – getrennt von der täglichen Arbeit mit
// Unterricht, Schüler:innen und Finanzen.
export default function WebsiteView({ view: viewParam, onView }) {
  const { adminFetch, notify, settings, saveSettings } = useAdmin();
  const { confirm } = useDialogs();
  const view = subViewFrom("website", viewParam);

  const [offers, setOffers] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [editingOffer, setEditingOffer] = useState(null);
  const [editingTestimonial, setEditingTestimonial] = useState(null);

  const load = useCallback(async () => {
    try {
      const [o, t] = await Promise.all([adminFetch("/api/admin/offers"), adminFetch("/api/admin/testimonials")]);
      setOffers(o.offers);
      setTestimonials(t.testimonials);
    } catch (err) {
      notify(err.message);
    }
  }, [adminFetch, notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function saveOffer(form, id) {
    const isSession = form.type === "session";
    const payload = {
      type: form.type,
      title: form.title,
      subject: form.subject,
      mode: form.mode,
      catchmentAreaText: form.catchmentAreaText,
      cancellationText: form.cancellationText,
      validityText: form.validityText,
      description: form.description,
      features: form.featuresText.split("\n").map((f) => f.trim()).filter(Boolean),
      priceCents: Math.round(parseFloat(String(form.price).replace(",", ".")) * 100) || 0,
      listPriceCents: String(form.listPrice).trim()
        ? Math.round(parseFloat(String(form.listPrice).replace(",", ".")) * 100) || null
        : null,
      active: form.active,
      earlyStartPossible: form.earlyStartPossible,
      minClass: form.minClass ? Number(form.minClass) : null,
      maxClass: form.maxClass ? Number(form.maxClass) : null,
    };
    if (isSession) {
      const minutes = Number(form.durationMinutes) || 45;
      payload.durationMinutes = minutes;
      payload.durationLabel = minutes === 90 ? "90 Minuten (Doppelstunde)" : `${minutes} Minuten`;
      payload.sessionCount = null;
      payload.sessionMinutes = null;
      payload.weeks = null;
    } else {
      payload.durationMinutes = null;
      payload.sessionCount = Number(form.sessionCount) || null;
      payload.sessionMinutes = Number(form.sessionMinutes) || null;
      payload.weeks = Number(form.weeks) || null;
      // Bei Paketen wird die Beschreibung aus den strukturierten Feldern
      // gebildet (lib/pricing.js); der freie Text bleibt Rückfall für ältere
      // Angebote.
      payload.durationLabel = form.durationLabel;
    }
    try {
      if (id) await adminFetch(`/api/admin/offers/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await adminFetch("/api/admin/offers", { method: "POST", body: JSON.stringify(payload) });
      setEditingOffer(null);
      notify("Angebot gespeichert.");
      load();
    } catch (err) {
      notify(err.message);
    }
  }

  async function patchOffer(offer, patch, message) {
    try {
      await adminFetch(`/api/admin/offers/${offer._id}`, { method: "PATCH", body: JSON.stringify(patch) });
      if (message) notify(message);
      load();
    } catch (err) {
      notify(err.message);
    }
  }

  async function deleteOffer(offer) {
    const ok = await confirm({
      title: `„${offer.title}“ löschen?`,
      message: "Das Angebot verschwindet von der Website. Bereits erfolgte Buchungen bleiben erhalten.",
      confirmLabel: "Angebot löschen",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminFetch(`/api/admin/offers/${offer._id}`, { method: "DELETE" });
      notify("Angebot gelöscht.");
      load();
    } catch (err) {
      notify(err.message);
    }
  }

  async function saveTestimonial(form, id) {
    const payload = { name: form.name, role: form.role, text: form.text, active: form.active };
    try {
      if (id) await adminFetch(`/api/admin/testimonials/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await adminFetch("/api/admin/testimonials", { method: "POST", body: JSON.stringify(payload) });
      setEditingTestimonial(null);
      notify("Rückmeldung gespeichert.");
      load();
    } catch (err) {
      notify(err.message);
    }
  }

  async function deleteTestimonial(item) {
    const ok = await confirm({
      title: `Rückmeldung von ${item.name} löschen?`,
      confirmLabel: "Löschen",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminFetch(`/api/admin/testimonials/${item._id}`, { method: "DELETE" });
      notify("Rückmeldung gelöscht.");
      load();
    } catch (err) {
      notify(err.message);
    }
  }

  // Formular-Werte aus einem gespeicherten Angebot (Zahlen als Text).
  function offerToForm(offer) {
    return {
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
      earlyStartPossible: Boolean(offer.earlyStartPossible),
      minClass: offer.minClass ? String(offer.minClass) : "",
      maxClass: offer.maxClass ? String(offer.maxClass) : "",
    };
  }

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2" aria-label="Website-Ansichten">
        {SUB_VIEWS.website.map(([key, label]) => (
          <button
            key={key}
            onClick={() => onView(key)}
            aria-current={view === key ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              view === key ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {view === "angebote" &&
        (editingOffer ? (
          <OfferForm
            initial={editingOffer === "new" ? EMPTY_OFFER : editingOffer}
            onCancel={() => setEditingOffer(null)}
            onSave={(form) => saveOffer(form, editingOffer === "new" ? null : editingOffer._id)}
          />
        ) : (
          <div className="space-y-4">
            <Toolbar title="Angebote" hint="Was auf der Angebotsseite buchbar ist.">
              <Button variant="primary" onClick={() => setEditingOffer("new")}>
                Neues Angebot
              </Button>
            </Toolbar>
            <DataTable
              rows={offers}
              getRowKey={(o) => o._id}
              empty="Noch keine Angebote angelegt."
              columns={[
                {
                  key: "title",
                  header: "Angebot",
                  priority: "primary",
                  cell: (o) => (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{o.title}</span>
                      <Badge tone="indigo">{o.type === "session" ? "Einzelstunde" : "Paket"}</Badge>
                      {o.active ? null : <Badge tone="slate">inaktiv</Badge>}
                    </span>
                  ),
                },
                { key: "subject", header: "Fach", cell: (o) => o.subject || "–" },
                { key: "duration", header: "Umfang", cell: (o) => o.durationLabel || "–" },
                { key: "classes", header: "Klassen", cell: (o) => formatClassRange(o) || "alle", priority: "meta" },
                { key: "price", header: "Preis", align: "right", width: "7rem", cell: (o) => formatPrice(o.priceCents) },
              ]}
              actions={(o) => [
                { label: "Bearbeiten", onClick: () => setEditingOffer(offerToForm(o)) },
                {
                  label: o.active ? "Deaktivieren" : "Aktivieren",
                  onClick: () => patchOffer(o, { active: !o.active }, o.active ? "Angebot deaktiviert." : "Angebot aktiviert."),
                },
                { label: "Löschen", tone: "red", onClick: () => deleteOffer(o) },
              ]}
            />
          </div>
        ))}

      {view === "rueckmeldungen" &&
        (editingTestimonial ? (
          <TestimonialForm
            initial={editingTestimonial === "new" ? EMPTY_TESTIMONIAL : editingTestimonial}
            onCancel={() => setEditingTestimonial(null)}
            onSave={(form) => saveTestimonial(form, editingTestimonial === "new" ? null : editingTestimonial._id)}
          />
        ) : (
          <div className="space-y-4">
            <Toolbar title="Rückmeldungen" hint="Zitate auf der Startseite. Nur mit Einverständnis der Personen.">
              <Button variant="primary" onClick={() => setEditingTestimonial("new")}>
                Neue Rückmeldung
              </Button>
            </Toolbar>
            <DataTable
              rows={testimonials}
              getRowKey={(t) => t._id}
              empty="Noch keine Rückmeldungen."
              columns={[
                {
                  key: "name",
                  header: "Person",
                  priority: "primary",
                  cell: (t) => (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{t.name}</span>
                      {t.role ? <span className="text-xs text-slate-500">{t.role}</span> : null}
                      {t.active ? null : <Badge tone="slate">inaktiv</Badge>}
                    </span>
                  ),
                },
                { key: "text", header: "Text", cell: (t) => <span className="text-slate-700">„{t.text}“</span> },
              ]}
              actions={(t) => [
                { label: "Bearbeiten", onClick: () => setEditingTestimonial(t) },
                {
                  label: t.active ? "Ausblenden" : "Anzeigen",
                  onClick: async () => {
                    try {
                      await adminFetch(`/api/admin/testimonials/${t._id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ active: !t.active }),
                      });
                      load();
                    } catch (err) {
                      notify(err.message);
                    }
                  },
                },
                { label: "Löschen", tone: "red", onClick: () => deleteTestimonial(t) },
              ]}
            />
          </div>
        ))}

      {view === "einstellungen" && (
        <div className="space-y-4">
          <Toolbar title="Einstellungen" hint="Texte, Kontaktdaten und Buchungsfenster der Website." />
          {settings ? <SettingsForm settings={settings} onSave={(patch) => saveSettings(patch)} /> : <p className="text-sm text-slate-500">Lädt …</p>}
        </div>
      )}
    </div>
  );
}
