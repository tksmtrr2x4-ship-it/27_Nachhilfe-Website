import "./cockpit.css";
import AdminGate from "@/components/admin/shell/AdminGate";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: true },
  // Installierbare App (Chrome/Edge: "App installieren", Safari: "Zum Dock
  // hinzufügen"). Manifest und Service Worker gelten nur für /admin.
  manifest: "/admin.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Lernsprung",
    statusBarStyle: "default",
  },
  icons: {
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport = {
  themeColor: "#000000",
};

// Die PIN-Abfrage und der Rahmen (Navigation, Meldungen) liegen im Layout,
// damit jeder Bereich eine eigene Adresse hat und beim Wechsel nur der Inhalt
// neu geladen wird.
export default function AdminLayout({ children }) {
  return <AdminGate>{children}</AdminGate>;
}
