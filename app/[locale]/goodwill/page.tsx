import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { STATES } from "@/lib/cities";
import { CityHeader, CityFooter } from "@/components/city/chrome";
import { JsonLd } from "@/components/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SITE_URL = "https://www.thriftly.xyz";

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: "pages"});
  return pageMetadata(t("hub"), t("hubDescription"), "/goodwill", true, locale);
}

export default async function GoodwillHub({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages");
  const base = SITE_URL + (locale === "en" ? "" : `/${locale}`);
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t("home"), item: base },
        { "@type": "ListItem", position: 2, name: t("hubShort"), item: `${base}/goodwill` },
      ],
    },
    {
      "@type": "ItemList",
      name: t("hub"),
      itemListElement: STATES.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: t("stateTitle", {place: s.name}),
        item: `${base}/goodwill/state/${s.slug}`,
      })),
    },
  ],
};


  const sorted = [...STATES].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={jsonLd} />
      <CityHeader />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <div className="site-gutter mx-auto max-w-5xl py-8 sm:py-14">
          <nav aria-label={t("breadcrumb")} className="text-[13px] text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              {t("home")}
            </Link>
            <span className="px-1.5">/</span>
            <span className="text-foreground">{t("hubShort")}</span>
          </nav>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("hub")}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed sm:text-lg text-muted-foreground">
            {t("hubIntro")}
          </p>

          <div className="mt-7 grid grid-cols-1 gap-x-8 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {sorted.map((s) => (
              <Link
                key={s.slug}
                href={`/goodwill/state/${s.slug}`}
                className="group flex min-h-14 items-center justify-between gap-3 border-b border-border py-3 transition-colors hover:text-brand"
              >
                <span className="font-medium">{s.name}</span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </Link>
            ))}
          </div>

          <div className="mt-10 border-t border-border pt-6">
            <p className="text-[15px] text-muted-foreground">
              {t("exact")}
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
