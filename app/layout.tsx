import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const TITLE = "Goodwill Locator — find the best thrift near you";
const DESCRIPTION =
  "Rank nearby Goodwill stores by neighborhood affluence to find where the best donations land.";

export const metadata: Metadata = {
  metadataBase: new URL("https://goodwill-locator.vercel.app"),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Goodwill Locator",
  openGraph: {
    type: "website",
    url: "https://goodwill-locator.vercel.app",
    siteName: "Goodwill Locator",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Goodwill Locator",
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
