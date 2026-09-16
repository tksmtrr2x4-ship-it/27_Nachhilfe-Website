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
  themeColor: "#4f46e5",
};

export default function AdminLayout({ children }) {
  return children;
}
