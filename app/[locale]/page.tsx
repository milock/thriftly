import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ArrowRight } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { CoffeeLink } from "@/components/coffee-link";
import { GithubLink, GithubMark, REPO_URL } from "@/components/github-link";
import { HomeStorePreview } from "@/components/home-store-preview";
import { locateBundledStores } from "@/lib/locate";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WEIGHTS } from "@/lib/reference-ranges";
import { getCity } from "@/lib/cities";
import { BRANDS } from "@/lib/brands";
import type { FactorKey } from "@/lib/types";

const ORDER: FactorKey[] = [
  "medianHomeValue",
  "medianHouseholdIncome",
  "pctBachelorsPlus",
  "medianGrossRent",
];

// A handful of high-recognition cities for the landing strip; the hub covers all states.
const POPULAR_CITY_SLUGS = [
  "new-york-ny",
  "los-angeles-ca",
  "chicago-il",
  "houston-tx",
  "phoenix-az",
  "san-diego-ca",
  "dallas-tx",
  "austin-tx",
  "seattle-wa",
  "denver-co",
  "atlanta-ga",
  "miami-fl",
];

export default async function Landing({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages");
  const directory = await getTranslations("directory");
  const listing = await getTranslations("listing");
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="site-gutter mx-auto flex min-h-14 max-w-6xl items-center justify-between gap-2 py-2">
          <Wordmark />
          <nav className="flex items-center justify-end gap-1 sm:gap-3">
            <Link
              href="#how-it-works"
              className="hidden rounded-md px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground lg:block"
            >
              {t("howWorks")}
            </Link>
            <LanguageSwitcher />
            <GithubLink className="hidden lg:inline-flex" />
            <CoffeeLink className="hidden lg:inline-flex" />
            <ThemeToggle />
            <Link href="/search" className={cn(buttonVariants({ size: "sm" }), "hidden h-11 gap-1.5 px-3.5 sm:inline-flex")}>
              {t("launch")}
              <ArrowRight className="size-3.5 shrink-0 rtl:rotate-180" />
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="site-gutter mx-auto grid max-w-6xl items-center gap-7 pb-10 pt-8 sm:gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24 lg:pt-20">
            <div className="animate-in fade-in slide-in-from-bottom-3 relative motion-reduce:animate-none duration-700">
              <h1 className="text-[2.5rem] font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem]">
                {t("hero")}
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed sm:text-lg text-muted-foreground">
                {t("heroBody")}
              </p>
              <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                <Link
                  href="/search"
                  className={cn(buttonVariants({ size: "lg" }), "min-h-12 h-auto whitespace-normal bg-brand py-3 gap-2 px-6 text-[15px] text-brand-foreground hover:bg-brand/90")}
                >
                  {t("find")}
                  <ArrowRight className="size-4 shrink-0 rtl:rotate-180" />
                </Link>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-0 text-sm font-medium">
                <Link href="#how-it-works" className="inline-flex min-h-11 items-center text-muted-foreground underline underline-offset-4 hover:text-foreground">{t("seeHow")}</Link>
                <Link href="/thrift-stores" className="inline-flex min-h-11 items-center gap-2 underline underline-offset-4">{t("browse")} <ArrowRight className="size-4 shrink-0 rtl:rotate-180" /></Link>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("free")}
              </p>
            </div>

            {/* Hero preview */}
            <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both relative delay-150 duration-700">

              <PreviewPanel />
            </div>
          </div>
        </section>

        {/* Browse by city */}
        <section className="border-t border-border">
          <div className="site-gutter mx-auto max-w-6xl py-12 sm:py-16">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("browse")}
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              {t("browseIntro")}
            </p>
            <div className="mt-6 grid grid-cols-1 gap-x-6 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {POPULAR_CITY_SLUGS.map((slug) => {
                const c = getCity(slug);
                if (!c) return null;
                return (
                  <Link
                    key={slug}
                    href={`/thrift-stores/${slug}`}
                    prefetch={false}
                    className="flex min-h-12 items-center border-b border-border py-3 text-sm font-medium transition-colors hover:text-brand"
                  >
                    {c.city}, {c.state}
                  </Link>
                );
              })}
              <Link
                href="/thrift-stores"
                className="col-span-full mt-3 inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold underline underline-offset-4"
              >
                {directory("browseCities")}
                <ArrowRight className="size-3.5 shrink-0 rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="site-gutter mx-auto max-w-6xl py-12 sm:py-16">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{directory("browseBrands")}</h2>
            <div className="mt-5 grid gap-x-6 min-[360px]:grid-cols-2 sm:grid-cols-4">
              {BRANDS.filter(brand => brand.featured).map(brand => <Link key={brand.id} href={`/${brand.id}`} className="flex min-h-12 items-center border-b border-border py-3 text-sm font-medium hover:text-brand">{brand.name}</Link>)}
            </div>
          </div>
        </section>

        {/* Insight */}
        <section className="border-y border-border bg-card/50">
          <div className="site-gutter mx-auto max-w-6xl py-12 sm:py-16">
            <h2 className="sr-only">{t("plan")}</h2>
            <div className="grid gap-7 sm:grid-cols-3 sm:gap-10">
              {[0, 1, 2].map((s) => (
                <div key={s} className="grid grid-cols-[2rem_1fr] gap-x-3 sm:block">
                  <span className="tabular row-span-2 block text-xl font-semibold tracking-tight text-[var(--brand)]">
                    {s + 1}
                  </span>
                  <h3 className="text-lg font-semibold sm:mt-2.5">{t(`step${s}Title`)}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{t(`step${s}Body`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How the score works */}
        <section id="how-it-works" className="scroll-mt-16">
          <div className="site-gutter mx-auto max-w-6xl py-12 sm:py-20">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("scoreHow")}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t("scoreIntro")}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{listing("scoreMethod")}</p>
              <Link href="/how-we-score" className="mt-2 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">{t("methodLink")}</Link>
            </div>
            <h3 className="mt-7 text-lg font-semibold sm:mt-10">{listing("neighborhoodScore")}</h3>
            <div className="mt-3 grid gap-x-10 sm:grid-cols-2">
              {ORDER.map((key) => {
                return (
                  <div
                    key={key}
                    className="border-t border-border py-6"
                  >
                    <div>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h4 className="font-semibold">{t(`factor_${key}`)}</h4>
                        <span className="tabular text-xs text-muted-foreground">
                          {t("weight", {value: Math.round(WEIGHTS[key] * 100)})}
                        </span>
                      </div>
                      <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
                        {t(`factorBody_${key}`)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Features */}
            <div className="mt-6 grid gap-x-10 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="border-t border-border py-5"
                >
                  <h3 className="font-semibold">{t(`feature${i}Title`)}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{t(`feature${i}Body`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-border">
          <div className="site-gutter mx-auto flex max-w-6xl flex-col items-start gap-6 py-10 sm:py-12 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
            <div>
              <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
                {t("cta")}
              </h2>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                {t("ctaBody")}
              </p>
            </div>
            <Link
              href="/search"
              className={cn(buttonVariants({ size: "lg" }), "min-h-12 h-auto shrink-0 whitespace-normal bg-brand py-3 gap-2 px-6 text-[15px] text-brand-foreground hover:bg-brand/90")}
            >
              {t("locator")}
              <ArrowRight className="size-4 shrink-0 rtl:rotate-180" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <Wordmark />
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-foreground underline-offset-4 hover:underline"
            >
              <GithubMark className="size-3.5 shrink-0 rtl:rotate-180" />
              {t("github")}
            </a>
          </div>
          <p className="max-w-md leading-relaxed">
            {t("sources")}: {" "}
            <a
              href="https://www.census.gov/programs-surveys/acs"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t("census")}
            </a>{", "}
            <a href="https://www.alltheplaces.xyz/" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline-offset-4 hover:underline">AllThePlaces</a>{", "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              OpenStreetMap
            </a>
            .{" "}{t("limits")}  <Link className="underline" href="/how-we-score">{t("methodLink")}</Link>.
          </p>
        </div>
        <div className="site-gutter mx-auto flex max-w-5xl gap-5 pb-6 text-sm text-muted-foreground"><Link href="/privacy" className="underline">{directory("privacy")}</Link><Link href="/terms" className="underline">{directory("terms")}</Link></div>
      </footer>
    </div>
  );
}

/** Real confirmed stores demonstrate the same scoring model as search. */
function PreviewPanel() {
  const stores = locateBundledStores({lat:32.7157,lon:-117.1611},15).slice(0,3);
  return <HomeStorePreview stores={stores}/>;
}
