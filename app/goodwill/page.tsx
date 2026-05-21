import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { METROS } from "@/lib/metros";
import { CityHeader, CityFooter } from "@/components/city/chrome";
import { JsonLd } from "@/components/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SITE_URL = "https://www.thriftly.xyz";

export const metadata: Metadata = {
  title: "Goodwill stores by city",
  description:
    "Browse the best Goodwill thrift stores in major U.S. cities, each ranked 0 to 100 by neighborhood affluence. Find the top-rated Goodwill locations near you.",
  alternates: { canonical: "/goodwill" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Goodwill stores by city", item: `${SITE_URL}/goodwill` },
      ],
    },
    {
      "@type": "ItemList",
      name: "Goodwill stores by city",
      itemListElement: METROS.map((m, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `Goodwill stores in ${m.city}, ${m.state}`,
        item: `${SITE_URL}/goodwill/${m.slug}`,
      })),
    },
  ],
};

export default function GoodwillHub() {
  const sorted = [...METROS].sort((a, b) => a.city.localeCompare(b.city));
  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={jsonLd} />
      <CityHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
          <nav aria-label="Breadcrumb" className="text-[13px] text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <span className="px-1.5">/</span>
            <span className="text-foreground">Goodwill by city</span>
          </nav>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Goodwill stores by city
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Pick a city to see every Goodwill nearby, ranked by the wealth of the surrounding
            neighborhoods. Better-off areas tend to get better donations, so the ranking points you
            to the best odds of a good haul.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((m) => (
              <Link
                key={m.slug}
                href={`/goodwill/${m.slug}`}
                className="group flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-foreground/20 hover:bg-accent"
              >
                <span className="flex items-center gap-2.5">
                  <MapPin className="size-4 text-muted-foreground" />
                  <span className="font-medium">
                    {m.city}, {m.state}
                  </span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-border bg-card/50 p-6 text-center">
            <p className="text-[15px] text-muted-foreground">
              Don&apos;t see your city? The live locator works anywhere in the U.S.
            </p>
            <Link
              href="/search"
              className={cn(buttonVariants({ size: "lg" }), "mt-4 h-11 gap-2 px-5 text-[15px]")}
            >
              Search Goodwills near you
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </main>
      <CityFooter />
    </div>
  );
}
