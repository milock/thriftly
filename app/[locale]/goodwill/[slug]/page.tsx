import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { pageMetadata } from "@/lib/seo";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, ChevronDown } from "lucide-react";
import { getCity, citiesInState, STATES, CITIES, type City } from "@/lib/cities";
import { cityCentroid } from "@/lib/city-data";
import { locateBundledStores, datasetGeneratedAt } from "@/lib/locate";
import type { ScoredStore } from "@/lib/types";
import { BrandNavigation } from "@/components/city/brand-navigation";
import { CityStores } from "@/components/city/city-stores";
import { AddToOsm } from "@/components/add-to-osm";
import { CityHeader, CityFooter } from "@/components/city/chrome";
import { ScrollToTop } from "@/components/scroll-to-top";
import { JsonLd } from "@/components/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SITE_URL = "https://www.thriftly.xyz";

export const revalidate = 86400;
export const dynamicParams = false;

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
// Keep page content and indexability deterministic. React cache dedupes calls.
const getCityResult = cache(async (c: City): Promise<CityResult> => {
  const coords = cityCentroid(c.slug);
  if (!coords) return { stores: [], lat: null, lon: null };
  const stores = locateBundledStores(coords, c.radiusMiles, ["goodwill"]);
  return { stores, lat: coords.lat, lon: coords.lon };
});

function stateSlugFor(code: string): string | undefined {
  return STATES.find((s) => s.code === code)?.slug;
}

function searchHref(c: City, lat: number | null, lon: number | null): string {
  const label = encodeURIComponent(`${c.city}, ${c.state}`);
  if (lat == null || lon == null) return `/search?label=${label}&brands=goodwill`;
  return `/search?lat=${lat}&lon=${lon}&radius=${c.radiusMiles}&label=${label}&brands=goodwill`;
}

function buildFaqs(c: City, stores: ScoredStore[], t: Awaited<ReturnType<typeof getTranslations>>) {
  const top = stores.find(store => store.score.catchment.tractCount > 0 && Object.values(store.score.factors).some(factor => factor.value != null));
  return [
    {q: t("faqBestQ", {city: c.city}), a: top ? t("faqBestA", {place: top.neighborhood ?? top.locality ?? c.city, score: Math.round(top.score.total)}) : t("faqNoScore")},
    {q: t("faqScoreQ", {city: c.city}), a: t("faqScoreA")},
    {q: t("faqCountQ", {city: c.city}), a: t("faqCountA", {city: c.city, count: stores.length, radius: c.radiusMiles})},
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const c = getCity(slug);
  if (!c) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: "pages"});
  const {stores} = await getCityResult(c);
  const title = t("cityMeta", {place: `${c.city}, ${c.state}`});
  const description = stores.length
    ? t("cityDescription", {count: stores.length, radius: c.radiusMiles, place: `${c.city}, ${c.stateName}`})
    : t("cityEmptyDescription", {place: `${c.city}, ${c.stateName}`});
  return pageMetadata(title, description, `/goodwill/${c.slug}`, stores.length > 0, locale);

}

export default async function CityPage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale } = await params;
  const c = getCity(slug);
  if (!c) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: "pages"});

  const { stores, lat, lon } = await getCityResult(c);
  const count = stores.length;
  const faqs = buildFaqs(c, stores, t);
  const stateSlug = stateSlugFor(c.state);

  const related = citiesInState(c.state)
    .filter((x) => x.slug !== c.slug)
    .slice(0, 8);

  const base = SITE_URL + (locale === "en" ? "" : `/${locale}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("home"), item: base },
          { "@type": "ListItem", position: 2, name: t("hubShort"), item: `${base}/goodwill` },
          ...(stateSlug
            ? [{ "@type": "ListItem", position: 3, name: c.stateName, item: `${base}/goodwill/state/${stateSlug}` }]
            : []),
          { "@type": "ListItem", position: stateSlug ? 4 : 3, name: `${c.city}, ${c.state}`, item: `${base}/goodwill/${c.slug}` },
        ],
      },
      ...(count
        ? [
            {
              "@type": "ItemList",
              name: t("cityList", {place: `${c.city}, ${c.state}`}),
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
      <main id="main-content" tabIndex={-1} className="flex-1">
        <div className="site-gutter mx-auto max-w-3xl py-6 sm:py-12">
          <nav aria-label={t("breadcrumb")} className="text-[13px] text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              {t("home")}
            </Link>
            <span className="px-1.5">/</span>
            <Link href="/goodwill" className="hover:text-foreground">
              {t("states")}
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
            {t("stateTitle", {place: `${c.city}, ${c.state}`})}
          </h1>

          {count > 0 ? (
            <p className="mt-3 text-base leading-relaxed sm:text-lg text-muted-foreground">
              {t("cityIntro", {count, radius: c.radiusMiles, city: c.city})}
            </p>
          ) : (
            <p className="mt-3 text-base leading-relaxed sm:text-lg text-muted-foreground">
              {t("cityEmpty", {city: c.city})}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1">
            <Link
              href={searchHref(c, lat, lon)}
              className={cn(buttonVariants({ size: "lg" }), "min-h-12 h-auto w-full sm:w-auto whitespace-normal py-3 gap-2 px-5 text-[15px]")}
            >
              {t("openCity", {city: c.city})}
              <ArrowRight className="size-4 shrink-0 rtl:rotate-180" />
            </Link>
            <Link
              href="/how-we-score"
              className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {t("scoreHow")}
            </Link>
          </div>

          <BrandNavigation city={c} active="goodwill" />

          {count > 0 && (
            <section className="mt-6">
              <h2 className="text-xl font-semibold tracking-tight">
                {t("mapped", {city: c.city})}
              </h2>
              <p className="mt-1.5 text-[14px] text-muted-foreground">
                {t("sorted")}
              </p>
              <div className="mt-3">
                <CityStores
                  brandIds={["goodwill"]}
                  initial={stores}
                  cityName={c.city}
                  lat={lat}
                  lon={lon}
                  radiusMiles={c.radiusMiles}
                  generatedAt={datasetGeneratedAt(["goodwill"])}
                  initialDateLabel={datasetGeneratedAt(["goodwill"]) ? new Intl.DateTimeFormat(locale, {dateStyle: "medium", timeZone: "UTC"}).format(new Date(datasetGeneratedAt(["goodwill"])!)) : undefined}
                />
              </div>
              {lat != null && lon != null && (
                <div className="mt-4">
                  <AddToOsm lat={lat} lon={lon} />
                </div>
              )}
            </section>
          )}

          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            {t("dataset")}: <time dateTime={datasetGeneratedAt(["goodwill"]) ?? undefined}>
              {datasetGeneratedAt(["goodwill"]) ? new Intl.DateTimeFormat(locale, {dateStyle: "long", timeZone: "UTC"}).format(new Date(datasetGeneratedAt(["goodwill"])!)) : t("dateUnavailable")}
            </time>. {t("independent")}
          </p>
          {c.slug === "los-angeles-ca" && <aside className="mt-10 rounded-xl border border-border p-5">
            <h2 className="text-lg font-semibold">{t("outletQuestion")}</h2>
            <Link className="mt-2 inline-block underline" href="/goodwill/los-angeles-ca/outlets">{t("outletLink")}</Link>
          </aside>}
          <section className="mt-14">
            <h2 className="text-xl font-semibold tracking-tight">
              {t("faqTitle", {city: c.city})}
            </h2>
            <div className="mt-4 divide-y divide-border border-y border-border">
              {faqs.map((f) => (
                <details key={f.q} className="group py-1">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium [&::-webkit-details-marker]:hidden"><h3>{f.q}</h3><ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden /></summary>
                  <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          {related.length > 0 && (
            <section className="mt-14">
              <h2 className="text-xl font-semibold tracking-tight">{t("more", {place: c.stateName})}</h2>
              <div className="mt-4 grid grid-cols-1 gap-x-8 min-[400px]:grid-cols-2 sm:grid-cols-3">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/goodwill/${r.slug}`}
                    className="group flex min-h-14 items-center justify-between gap-3 border-b border-border py-3 text-sm font-medium transition-colors hover:text-brand"
                  >
                    {r.city}
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
                  </Link>
                ))}
              </div>
              {stateSlug && (
                <Link
                  href={`/goodwill/state/${stateSlug}`}
                  className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {t("allCities", {place: c.stateName})}
                  <ArrowRight className="size-3.5 shrink-0 rtl:rotate-180" />
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
