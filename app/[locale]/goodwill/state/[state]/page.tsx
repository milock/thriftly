import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { getState, citiesInState, STATES } from "@/lib/cities";
import { cityCentroid } from "@/lib/city-data";
import { locateBundledStores } from "@/lib/locate";
import { CityHeader, CityFooter } from "@/components/city/chrome";
import { ScrollToTop } from "@/components/scroll-to-top";
import { JsonLd } from "@/components/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamicParams = false;

const SITE_URL = "https://www.thriftly.xyz";

// Static: every state page lists its cities (links only), no data fetch.
export function generateStaticParams() {
  return STATES.map((s) => ({ state: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; locale: string }>;
}): Promise<Metadata> {
  const { state, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: "pages"});
  const s = getState(state);
  if (!s) return {};
  return pageMetadata(t("stateTitle", {place: s.name}), t("stateDescription", {place: s.name}), `/goodwill/state/${s.slug}`, true, locale);
}

export default async function StatePage({ params }: { params: Promise<{ state: string; locale: string }> }) {
  const { state, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: "pages"});
  const s = getState(state);
  if (!s) notFound();

  const cities = citiesInState(s.code).filter(city => {
    const center = cityCentroid(city.slug);
    return center && locateBundledStores(center, city.radiusMiles, ["goodwill"]).length > 0;
  });

  const base = SITE_URL + (locale === "en" ? "" : `/${locale}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("home"), item: base },
          { "@type": "ListItem", position: 2, name: t("hubShort"), item: `${base}/goodwill` },
          { "@type": "ListItem", position: 3, name: s.name, item: `${base}/goodwill/state/${s.slug}` },
        ],
      },
      {
        "@type": "ItemList",
        name: t("stateList", {place: s.name}),
        itemListElement: cities.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: t("stateTitle", {place: `${c.city}, ${c.state}`}),
          item: `${base}/goodwill/${c.slug}`,
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
        <div className="site-gutter mx-auto max-w-3xl py-8 sm:py-14">
          <nav aria-label={t("breadcrumb")} className="text-[13px] text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              {t("home")}
            </Link>
            <span className="px-1.5">/</span>
            <Link href="/goodwill" className="hover:text-foreground">
              {t("states")}
            </Link>
            <span className="px-1.5">/</span>
            <span className="text-foreground">{s.name}</span>
          </nav>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("stateTitle", {place: s.name})}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed sm:text-lg text-muted-foreground">
            {t("stateIntro")}
          </p>

          <div className="mt-7 grid grid-cols-1 gap-x-8 min-[400px]:grid-cols-2 lg:grid-cols-3">
            {cities.map((c) => (
              <Link
                key={c.slug}
                href={`/goodwill/${c.slug}`}
                className="group flex min-h-14 items-center justify-between gap-3 border-b border-border py-3 transition-colors hover:text-brand"
              >
                <span className="min-w-0">
                  <span className="font-medium">{c.city}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </Link>
            ))}
          </div>

          <div className="mt-10 border-t border-border pt-6">
            <p className="text-[15px] text-muted-foreground">
              {t("specific")}
            </p>
            <Link
              href="/search"
              className={cn(buttonVariants({ size: "lg" }), "mt-4 w-full sm:w-auto min-h-11 h-auto whitespace-normal py-3 gap-2 px-5 text-[15px]")}
            >
              {t("search")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </main>
      <CityFooter />
    </div>
  );
}
