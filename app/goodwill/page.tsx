import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { STATES } from "@/lib/cities";
import { CityHeader, CityFooter } from "@/components/city/chrome";
import { JsonLd } from "@/components/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SITE_URL = "https://www.thriftly.xyz";

export const metadata: Metadata = {
  title: "Goodwill stores by state",
  description:
    "Browse the best Goodwill thrift stores across all 50 states, by city, each ranked 0 to 100 by neighborhood affluence. Find the top-rated Goodwill locations near you.",
  alternates: { canonical: "/goodwill" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Goodwill by state", item: `${SITE_URL}/goodwill` },
      ],
    },
    {
      "@type": "ItemList",
      name: "Goodwill stores by state",
      itemListElement: STATES.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `Goodwill stores in ${s.name}`,
        item: `${SITE_URL}/goodwill/state/${s.slug}`,
      })),
    },
  ],
};

export default function GoodwillHub() {
  const sorted = [...STATES].sort((a, b) => a.name.localeCompare(b.name));
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
            <span className="text-foreground">Goodwill by state</span>
          </nav>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Goodwill stores by state
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Pick a state, then a city, to see every Goodwill nearby ranked by the wealth of the
            surrounding neighborhoods. Better-off areas tend to get better donations, so the ranking
            points you to the best odds of a good haul.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {sorted.map((s) => (
              <Link
                key={s.slug}
                href={`/goodwill/state/${s.slug}`}
                className="group flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/20 hover:bg-accent"
              >
                <span className="font-medium">{s.name}</span>
                <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-border bg-card/50 p-6 text-center">
            <p className="text-[15px] text-muted-foreground">
              Or skip the list and search your exact location.
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
