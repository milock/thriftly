import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/theme-provider";
import { JsonLd } from "@/components/json-ld";
import "./globals.css";

// Canonical host. The site serves on www (apex 307-redirects to www), so every
// emitted URL (canonical, OG, sitemap, JSON-LD) must use www to avoid pointing
// search engines at redirecting URLs.
const SITE_URL = "https://www.thriftly.xyz";
const TITLE = "Thriftly: find the best Goodwill near you";
const DESCRIPTION =
  "Find the best Goodwill near you. Thriftly ranks nearby thrift stores from 0 to 100 by neighborhood affluence, so you know where the best donations land.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s | Thriftly" },
  description: DESCRIPTION,
  applicationName: "Thriftly",
  authors: [{ name: "Thriftly" }],
  creator: "Thriftly",
  category: "lifestyle",
  keywords: [
    "goodwill near me",
    "best goodwill",
    "thrift stores near me",
    "goodwill locator",
    "thrift store finder",
    "best thrift stores",
    "goodwill store map",
    "thrifting",
  ],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Thriftly",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: "Find the Goodwill with the best stuff, ranked by neighborhood affluence.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
};

const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Thriftly",
      description: DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#org` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "Thriftly",
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
    },
    {
      "@type": "WebApplication",
      name: "Thriftly",
      url: SITE_URL,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web",
      browserRequirements: "Requires JavaScript",
      description: DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground min-h-full antialiased">
        <JsonLd data={siteJsonLd} />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
