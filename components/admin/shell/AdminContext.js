"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createAdminClient } from "@/components/admin/ui/pinFetch";

// Ein Zugang zu PIN, Schnittstellen, Meldungen und Website-Einstellungen für
// alle Bereiche. Vorher hielt app/admin/page.js all das selbst und gab es per
// Prop weiter; jede Änderung lud danach vier Endpunkte neu.

const AdminContext = createContext(null);

export function AdminProvider({ pin, onLogout, children }) {
  const [notice, setNotice] = useState("");
  const [settings, setSettings] = useState(null);

  const client = useMemo(() => createAdminClient(pin, onLogout), [pin, onLogout]);

  // Panels erwarten weiterhin ein adminFetch(path, options) – identische
  // Signatur wie bisher, damit sie unverändert weiterlaufen.
  const adminFetch = useMemo(() => (path, options) => client.json(path, options), [client]);

  const notify = useCallback((message) => setNotice(message || ""), []);

  const reloadSettings = useCallback(async () => {
    try {
      const data = await client.json("/api/admin/settings");
      setSettings(data.settings);
      return data.settings;
    } catch (err) {
      setNotice(err.message);
      return null;
    }
  }, [client]);

  const saveSettings = useCallback(
    async (patch, message = "Einstellungen gespeichert.") => {
      try {
        const data = await client.json("/api/admin/settings", { method: "PATCH", body: JSON.stringify(patch) });
        setSettings(data.settings);
        setNotice(message);
        return data.settings;
      } catch (err) {
        setNotice(err.message);
        return null;
      }
    },
    [client]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reloadSettings();
  }, [reloadSettings]);

  const value = useMemo(
    () => ({ pin, client, adminFetch, notice, notify, settings, reloadSettings, saveSettings, logout: onLogout }),
    [pin, client, adminFetch, notice, notify, settings, reloadSettings, saveSettings, onLogout]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin außerhalb des Admin-Bereichs verwendet.");
  return ctx;
}
