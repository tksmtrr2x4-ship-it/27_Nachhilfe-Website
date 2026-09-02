import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ShopStatusBanner from "@/components/ShopStatusBanner";
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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function generateMetadata() {
  const settings = await getSettings();
  const description = `${settings.subline} Nachhilfe Villingen-Schwenningen von Jill Manuel Hils.`;
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${settings.siteName} – ${settings.slogan}`,
      template: `%s – ${settings.siteName}`,
    },
    description,
    openGraph: {
      title: `${settings.siteName} – ${settings.slogan}`,
      description,
      url: siteUrl,
      siteName: settings.siteName,
      locale: "de_DE",
      type: "website",
      images: ["/logo.png"],
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
  const logoSrc = getLogoSrc();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: settings.siteName,
    founder: "Jill Manuel Hils",
    description: settings.subline,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Aixheimer Straße 2",
      postalCode: "78056",
      addressLocality: "Villingen-Schwenningen",
      addressCountry: "DE",
    },
    areaServed: "Villingen-Schwenningen",
    telephone: settings.contactPhone || undefined,
    email: settings.contactEmail || undefined,
    url: siteUrl,
    priceRange: "€€",
  };

  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-slate-900">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Header siteName={settings.siteName} logoSrc={logoSrc} />
        <ShopStatusBanner settings={settings} />
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
