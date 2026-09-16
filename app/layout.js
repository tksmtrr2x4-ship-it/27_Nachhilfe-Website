import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ShopStatusBanner from "@/components/ShopStatusBanner";
import { getSettings } from "@/lib/db";
import { getLogoImage } from "@/lib/logo";
import { SITE_ORIGIN, OG_IMAGE } from "@/lib/seo";

export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata() {
  const settings = await getSettings();
  const description = `${settings.subline} Nachhilfe Villingen-Schwenningen von Jill Manuel Hils.`;
  return {
    // Basis für relative Canonical-/OG-URLs – immer die Hauptdomain.
    metadataBase: new URL(SITE_ORIGIN),
    title: {
      default: `${settings.siteName} – ${settings.slogan}`,
      template: `%s – ${settings.siteName}`,
    },
    description,
    openGraph: {
      title: `${settings.siteName} – ${settings.slogan}`,
      description,
      siteName: settings.siteName,
      locale: "de_DE",
      type: "website",
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary",
      title: `${settings.siteName} – ${settings.slogan}`,
      description,
      images: ["/logo.png"],
    },
  };
}

export default async function RootLayout({ children }) {
  const settings = await getSettings();
  const logo = getLogoImage();
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Header siteName={settings.siteName} logo={logo} />
        <ShopStatusBanner settings={settings} />
        <main className="flex-1">{children}</main>
        <Footer
          siteName={settings.siteName}
          contactEmail={settings.contactEmail}
          contactPhone={settings.contactPhone}
          logo={logo}
        />
      </body>
    </html>
  );
}
