import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getSettings } from "@/lib/db";
import { getLogoSrc } from "@/lib/logo";

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
  return {
    title: `${settings.siteName} – ${settings.slogan}`,
    description: settings.subline,
  };
}

export default async function RootLayout({ children }) {
  const settings = await getSettings();
  const logoSrc = getLogoSrc();

  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-slate-900">
        <Header siteName={settings.siteName} logoSrc={logoSrc} />
        <main className="flex-1">{children}</main>
        <Footer
          siteName={settings.siteName}
          contactEmail={settings.contactEmail}
          contactPhone={settings.contactPhone}
          logoSrc={logoSrc}
        />
      </body>
    </html>
  );
}
