import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { getState, citiesInState, STATES } from "@/lib/cities";
import { CityHeader, CityFooter } from "@/components/city/chrome";
import { ScrollToTop } from "@/components/scroll-to-top";
import { JsonLd } from "@/components/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SITE_URL = "https://www.thriftly.xyz";

// Static: every state page lists its cities (links only), no data fetch.
export function generateStaticParams() {
  return STATES.map((s) => ({ state: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>;
}): Promise<Metadata> {
  const { state } = await params;
  const s = getState(state);
  if (!s) return {};
  const title = `Best Goodwill stores in ${s.name}`;
  const description = `Browse Goodwill thrift stores across ${s.name} by city, each ranked 0 to 100 by neighborhood affluence. Find the top-rated Goodwill locations near you.`;
  return {
    title,
    description,
    alternates: { canonical: `/goodwill/state/${s.slug}` },
    openGraph: { title: `${title} | Thriftly`, description, url: `/goodwill/state/${s.slug}`, type: "website" },
  };
}

export default async function StatePage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  const s = getState(state);
  if (!s) notFound();

  const cities = citiesInState(s.code);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Goodwill by state", item: `${SITE_URL}/goodwill` },
          { "@type": "ListItem", position: 3, name: s.name, item: `${SITE_URL}/goodwill/state/${s.slug}` },
        ],
      },
      {
        "@type": "ItemList",
        name: `Goodwill stores in ${s.name} by city`,
        itemListElement: cities.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: `Goodwill stores in ${c.city}, ${c.state}`,
          item: `${SITE_URL}/goodwill/${c.slug}`,
        })),
      },
    ],
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={jsonLd} />
      <ScrollToTop />
      <CityHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
          <nav aria-label="Breadcrumb" className="text-[13px] text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <span className="px-1.5">/</span>
            <Link href="/goodwill" className="hover:text-foreground">
              States
            </Link>
            <span className="px-1.5">/</span>
            <span className="text-foreground">{s.name}</span>
          </nav>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Best Goodwill stores in {s.name}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Pick a city to see every Goodwill nearby, ranked by the wealth of the surrounding
            neighborhoods. Better-off areas tend to get better donations, so the ranking points you to
            the best odds of a good haul.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((c) => (
              <Link
                key={c.slug}
                href={`/goodwill/${c.slug}`}
                className="group flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-foreground/20 hover:bg-accent"
              >
                <span className="flex items-center gap-2.5">
                  <MapPin className="size-4 text-muted-foreground" />
                  <span className="font-medium">{c.city}</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-border bg-card/50 p-6 text-center">
            <p className="text-[15px] text-muted-foreground">
              Looking somewhere more specific? The live locator works anywhere in the U.S.
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
