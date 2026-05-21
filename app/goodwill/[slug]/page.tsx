import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { getMetro, METROS, type Metro } from "@/lib/metros";
import { locateStores } from "@/lib/locate";
import type { ScoredStore } from "@/lib/types";
import { RankedStores } from "@/components/city/ranked-stores";
import { CityHeader, CityFooter } from "@/components/city/chrome";
import { JsonLd } from "@/components/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SITE_URL = "https://www.thriftly.xyz";

// Cache each city page for a day (ISR): the first visit renders it (a skeleton
// shows via loading.tsx), then it's served from cache for everyone until the
// daily background refresh, not re-fetched per load. We deliberately don't
// generateStaticParams: pre-rendering would run Overpass + Census + dozens of
// reverse-geocodes per city during the build, and a transient build-time
// failure would cache an empty page for a day.
export const revalidate = 86400;
export const dynamicParams = true;

// Wrapped in React cache so generateMetadata and the page share a single fetch.
const getCityStores = cache(async (m: Metro): Promise<ScoredStore[]> => {
  try {
    return await locateStores({ lat: m.lat, lon: m.lon }, m.radiusMiles);
  } catch (err) {
    console.error(`city page locate failed: ${m.slug}`, err);
    return [];
  }
});

function searchHref(m: Metro): string {
  const label = encodeURIComponent(`${m.city}, ${m.state}`);
  return `/search?lat=${m.lat}&lon=${m.lon}&radius=${m.radiusMiles}&label=${label}`;
}

function buildFaqs(m: Metro, stores: ScoredStore[]) {
  const count = stores.length;
  const top = stores[0];
  const topPlace = top?.neighborhood ?? top?.locality ?? m.city;
  return [
    {
      q: `Which Goodwill in ${m.city} has the best stuff?`,
      a: top
        ? `Right now the ${topPlace} location has the highest Goods Score (${Math.round(top.score.total)} out of 100). The score reflects how affluent the surrounding neighborhoods are, which is a strong proxy for donation quality, and it refreshes as Census and store data update.`
        : `We don't have scored Goodwill data for ${m.city} yet. Try the live locator to search any spot in the U.S.`,
    },
    {
      q: `How does Thriftly rank ${m.city} Goodwill stores?`,
      a: `Each store gets a 0 to 100 Goods Score built from four U.S. Census measures of the area within about three miles: median home value, household income, share of college graduates, and median rent. Stores with wealthier surrounding neighborhoods score higher.`,
    },
    {
      q: `How many Goodwill locations are in ${m.city}?`,
      a: `Thriftly tracks ${count} Goodwill ${count === 1 ? "store" : "stores"} within ${m.radiusMiles} miles of downtown ${m.city}, using OpenStreetMap data. A store won't show up if it isn't tagged in OpenStreetMap, so coverage can be incomplete.`,
    },
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const m = getMetro(slug);
  if (!m) return {};
  const stores = await getCityStores(m);
  const count = stores.length;
  const title = `Best Goodwill stores in ${m.city}, ${m.state}`;
  const description = count
    ? `${count} Goodwill ${count === 1 ? "store" : "stores"} in ${m.city}, ${m.stateName}, ranked 0 to 100 by neighborhood affluence. See the top-rated locations with scores, directions, and a live map.`
    : `Find Goodwill thrift stores near ${m.city}, ${m.stateName}, ranked by neighborhood affluence on a live map.`;
  return {
    title,
    description,
    alternates: { canonical: `/goodwill/${m.slug}` },
    openGraph: { title: `${title} | Thriftly`, description, url: `/goodwill/${m.slug}`, type: "website" },
    // Don't index a city page with no store data; it has nothing unique to offer yet.
    robots: count ? undefined : { index: false, follow: true },
  };
}

export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = getMetro(slug);
  if (!m) notFound();

  const stores = await getCityStores(m);
  const count = stores.length;
  const top = stores[0];
  const faqs = buildFaqs(m, stores);

  const related = [
    ...METROS.filter((x) => x.state === m.state && x.slug !== m.slug),
    ...METROS.filter((x) => x.state !== m.state && x.slug !== m.slug),
  ].slice(0, 6);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Goodwill stores by city", item: `${SITE_URL}/goodwill` },
          { "@type": "ListItem", position: 3, name: `${m.city}, ${m.state}`, item: `${SITE_URL}/goodwill/${m.slug}` },
        ],
      },
      ...(count
        ? [
            {
              "@type": "ItemList",
              name: `Goodwill stores in ${m.city}, ${m.state} ranked by Goods Score`,
              numberOfItems: count,
              itemListOrder: "https://schema.org/ItemListOrderDescending",
              itemListElement: stores.slice(0, 20).map((s, i) => ({
                "@type": "ListItem",
                position: i + 1,
                item: {
                  "@type": "Store",
                  name: s.locality ? `${s.name}, ${s.locality}` : s.name,
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: s.street,
                    addressLocality: s.locality,
                    addressRegion: s.region,
                    addressCountry: "US",
                  },
                  geo: { "@type": "GeoCoordinates", latitude: s.location.lat, longitude: s.location.lon },
                },
              })),
            },
          ]
        : []),
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={jsonLd} />
      <CityHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="text-[13px] text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <span className="px-1.5">/</span>
            <Link href="/goodwill" className="hover:text-foreground">
              Goodwill by city
            </Link>
            <span className="px-1.5">/</span>
            <span className="text-foreground">
              {m.city}, {m.state}
            </span>
          </nav>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-[2.5rem] sm:leading-[1.1]">
            Best Goodwill stores in {m.city}, {m.state}
          </h1>

          {count > 0 ? (
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              There {count === 1 ? "is" : "are"} {count} Goodwill {count === 1 ? "store" : "stores"}{" "}
              within about {m.radiusMiles} miles of downtown {m.city}. Thriftly scores each one by how
              well-off the surrounding neighborhoods are, since stores in higher-income areas tend to
              get the better drop-offs.{" "}
              {top?.neighborhood || top?.locality
                ? `The ${top.neighborhood ?? top.locality} location ranks highest right now, at ${Math.round(top.score.total)} out of 100.`
                : `The top-ranked store scores ${Math.round(top.score.total)} out of 100.`}
            </p>
          ) : (
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              We don&apos;t have scored Goodwill data for {m.city} just yet. The live locator works
              anywhere in the U.S., so you can search this area directly.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={searchHref(m)}
              className={cn(buttonVariants({ size: "lg" }), "h-11 gap-2 px-5 text-[15px]")}
            >
              Open {m.city} on the live map
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/#how-it-works"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-5 text-[15px]")}
            >
              How the score works
            </Link>
          </div>

          {/* Ranked list */}
          {count > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-semibold tracking-tight">
                Every Goodwill near {m.city}, ranked
              </h2>
              <p className="mt-1.5 text-[14px] text-muted-foreground">
                Best odds first. Tap a store for directions.
              </p>
              <div className="mt-5">
                <RankedStores stores={stores} cityName={m.city} />
              </div>
            </section>
          )}

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-xl font-semibold tracking-tight">
              Goodwill in {m.city}: common questions
            </h2>
            <div className="mt-5 divide-y divide-border rounded-2xl border border-border bg-card">
              {faqs.map((f) => (
                <div key={f.q} className="p-5">
                  <h3 className="font-semibold">{f.q}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Internal links to other cities */}
          <section className="mt-14">
            <h2 className="text-xl font-semibold tracking-tight">Goodwill in other cities</h2>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/goodwill/${r.slug}`}
                  className="group flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-3 text-[14px] font-medium transition-colors hover:border-foreground/20 hover:bg-accent"
                >
                  <MapPin className="size-3.5 text-muted-foreground" />
                  {r.city}, {r.state}
                </Link>
              ))}
            </div>
            <Link
              href="/goodwill"
              className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-medium text-foreground underline-offset-4 hover:underline"
            >
              See all cities
              <ArrowRight className="size-3.5" />
            </Link>
          </section>
        </div>
      </main>
      <CityFooter />
    </div>
  );
}
