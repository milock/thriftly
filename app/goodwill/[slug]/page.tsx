import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { getCity, citiesInState, STATES, CITIES, type City } from "@/lib/cities";
import { cityCentroid } from "@/lib/city-data";
import { locateStores, datasetGeneratedAt } from "@/lib/locate";
import { geocodeAddress } from "@/lib/geocode";
import type { ScoredStore } from "@/lib/types";
import { CityStores } from "@/components/city/city-stores";
import { AddToOsm } from "@/components/add-to-osm";
import { CityHeader, CityFooter } from "@/components/city/chrome";
import { ScrollToTop } from "@/components/scroll-to-top";
import { JsonLd } from "@/components/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SITE_URL = "https://www.thriftly.xyz";

export const revalidate = 86400;
export const dynamicParams = true;

// Pre-render every city. Each just filters the bundled national dataset by the
// bundled centroid — no Overpass/Census/geocoding at build or request time.
export function generateStaticParams() {
  return CITIES.map((c) => ({ slug: c.slug }));
}

interface CityResult {
  stores: ScoredStore[];
  lat: number | null;
  lon: number | null;
}

// Locate the city via its bundled centroid, then filter the national dataset.
// No live geocoding (Nominatim is rate-limited). Only an unbundled city (none,
// since all are matched) would fall back to a live geocode. React cache dedupes.
const getCityResult = cache(async (c: City): Promise<CityResult> => {
  let coords = cityCentroid(c.slug);
  if (!coords) {
    try {
      coords = await geocodeAddress(`${c.city}, ${c.state}`);
    } catch {
      coords = null;
    }
  }
  if (!coords) return { stores: [], lat: null, lon: null };
  const stores = await locateStores(coords, c.radiusMiles);
  return { stores, lat: coords.lat, lon: coords.lon };
});

function stateSlugFor(code: string): string | undefined {
  return STATES.find((s) => s.code === code)?.slug;
}

function searchHref(c: City, lat: number | null, lon: number | null): string {
  const label = encodeURIComponent(`${c.city}, ${c.state}`);
  if (lat == null || lon == null) return `/search?label=${label}`;
  return `/search?lat=${lat}&lon=${lon}&radius=${c.radiusMiles}&label=${label}`;
}

function buildFaqs(c: City, stores: ScoredStore[]) {
  const count = stores.length;
  const top = stores[0];
  const topPlace = top?.neighborhood ?? top?.locality ?? c.city;
  return [
    {
      q: `Which Goodwill in ${c.city} has the best stuff?`,
      a: top
        ? `Right now the ${topPlace} location has the highest Goods Score (${Math.round(top.score.total)} out of 100). The score reflects how affluent the surrounding neighborhoods are, which is a strong proxy for donation quality, and it refreshes as Census and store data update.`
        : `We don't have scored Goodwill data for ${c.city} yet. Try the live locator to search any spot in the U.S.`,
    },
    {
      q: `How does Thriftly rank ${c.city} Goodwill stores?`,
      a: `Each store gets a 0 to 100 Goods Score built from four U.S. Census measures of the area within about three miles: median home value, household income, share of college graduates, and median rent. Stores with wealthier surrounding neighborhoods score higher.`,
    },
    {
      q: `How many Goodwill locations are in ${c.city}?`,
      a: `Thriftly tracks ${count} Goodwill ${count === 1 ? "store" : "stores"} within ${c.radiusMiles} miles of ${c.city}, using OpenStreetMap data. A store won't show up if it isn't tagged in OpenStreetMap, so coverage can be incomplete.`,
    },
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = getCity(slug);
  if (!c) return {};
  // No data fetch here: generateMetadata blocks the response (and the loading
  // skeleton), so it must stay fast. Build metadata from the static city record.
  const title = `Best Goodwill stores in ${c.city}, ${c.state}`;
  const description = `Find the best Goodwill thrift stores in ${c.city}, ${c.stateName}, ranked 0 to 100 by neighborhood affluence. See the top-rated locations with scores, directions, and a live map.`;
  return {
    title,
    description,
    alternates: { canonical: `/goodwill/${c.slug}` },
    openGraph: { title: `${title} | Thriftly`, description, url: `/goodwill/${c.slug}`, type: "website" },
  };
}

export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getCity(slug);
  if (!c) notFound();

  const { stores, lat, lon } = await getCityResult(c);
  const count = stores.length;
  const top = stores[0];
  const faqs = buildFaqs(c, stores);
  const stateSlug = stateSlugFor(c.state);

  const related = citiesInState(c.state)
    .filter((x) => x.slug !== c.slug)
    .slice(0, 8);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Goodwill by state", item: `${SITE_URL}/goodwill` },
          ...(stateSlug
            ? [{ "@type": "ListItem", position: 3, name: c.stateName, item: `${SITE_URL}/goodwill/state/${stateSlug}` }]
            : []),
          { "@type": "ListItem", position: stateSlug ? 4 : 3, name: `${c.city}, ${c.state}`, item: `${SITE_URL}/goodwill/${c.slug}` },
        ],
      },
      ...(count
        ? [
            {
              "@type": "ItemList",
              name: `Goodwill stores in ${c.city}, ${c.state} ranked by Goods Score`,
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
            {stateSlug && (
              <>
                <span className="px-1.5">/</span>
                <Link href={`/goodwill/state/${stateSlug}`} className="hover:text-foreground">
                  {c.stateName}
                </Link>
              </>
            )}
            <span className="px-1.5">/</span>
            <span className="text-foreground">
              {c.city}, {c.state}
            </span>
          </nav>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-[2.5rem] sm:leading-[1.1]">
            Best Goodwill stores in {c.city}, {c.state}
          </h1>

          {count > 0 ? (
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              There {count === 1 ? "is" : "are"} {count} Goodwill {count === 1 ? "store" : "stores"}{" "}
              within about {c.radiusMiles} miles of {c.city}. Thriftly scores each one by how well-off
              the surrounding neighborhoods are, since stores in higher-income areas tend to get the
              better drop-offs. The full ranking is below, best odds first.
            </p>
          ) : (
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              We don&apos;t have scored Goodwill data for {c.city} just yet. The live locator works
              anywhere in the U.S., so you can search this area directly.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={searchHref(c, lat, lon)}
              className={cn(buttonVariants({ size: "lg" }), "h-11 gap-2 px-5 text-[15px]")}
            >
              Open {c.city} on the live map
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/#how-it-works"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-5 text-[15px]")}
            >
              How the score works
            </Link>
          </div>

          {count > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-semibold tracking-tight">
                Every Goodwill near {c.city}, ranked
              </h2>
              <p className="mt-1.5 text-[14px] text-muted-foreground">
                Best odds first. Tap a store for directions.
              </p>
              <div className="mt-5">
                <CityStores
                  initial={stores}
                  cityName={c.city}
                  lat={lat}
                  lon={lon}
                  radiusMiles={c.radiusMiles}
                  generatedAt={datasetGeneratedAt()}
                />
              </div>
              {lat != null && lon != null && (
                <div className="mt-4">
                  <AddToOsm lat={lat} lon={lon} />
                </div>
              )}
            </section>
          )}

          <section className="mt-14">
            <h2 className="text-xl font-semibold tracking-tight">
              Goodwill in {c.city}: common questions
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

          {related.length > 0 && (
            <section className="mt-14">
              <h2 className="text-xl font-semibold tracking-tight">More Goodwill in {c.stateName}</h2>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/goodwill/${r.slug}`}
                    className="group flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-3 text-[14px] font-medium transition-colors hover:border-foreground/20 hover:bg-accent"
                  >
                    <MapPin className="size-3.5 text-muted-foreground" />
                    {r.city}
                  </Link>
                ))}
              </div>
              {stateSlug && (
                <Link
                  href={`/goodwill/state/${stateSlug}`}
                  className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-medium text-foreground underline-offset-4 hover:underline"
                >
                  All {c.stateName} cities
                  <ArrowRight className="size-3.5" />
                </Link>
              )}
            </section>
          )}
        </div>
      </main>
      <CityFooter />
    </div>
  );
}
