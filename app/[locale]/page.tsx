import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  ArrowRight,
  Home,
  Wallet,
  GraduationCap,
  KeyRound,
  Navigation,
  SlidersHorizontal,
  MapPinned,
  Sparkles,
  Crown,
} from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { CoffeeLink } from "@/components/coffee-link";
import { GithubLink, GithubMark, REPO_URL } from "@/components/github-link";
import { ScoreRing } from "@/components/score-ring";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WEIGHTS } from "@/lib/reference-ranges";
import { scoreColor } from "@/lib/score-color";
import { getCity } from "@/lib/cities";
import type { FactorKey } from "@/lib/types";

const ORDER: FactorKey[] = [
  "medianHomeValue",
  "medianHouseholdIncome",
  "pctBachelorsPlus",
  "medianGrossRent",
];

const FACTOR_ICONS: Record<FactorKey, typeof Home> = {
  medianHomeValue: Home,
  medianHouseholdIncome: Wallet,
  pctBachelorsPlus: GraduationCap,
  medianGrossRent: KeyRound,
};

const FEATURES = [Sparkles, MapPinned, Navigation, SlidersHorizontal];

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
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-2">
          <Wordmark />
          <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-3">
            <Link
              href="#how-it-works"
              className="hidden rounded-md px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              {t("howWorks")}
            </Link>
            <LanguageSwitcher />
            <GithubLink className="hidden sm:inline-flex" />
            <CoffeeLink className="hidden sm:inline-flex" />
            <ThemeToggle />
            <Link href="/search" className={cn(buttonVariants({ size: "sm" }), "hidden h-11 gap-1.5 px-3.5 sm:inline-flex")}>
              {t("launch")}
              <ArrowRight className="size-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-14 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28 lg:pt-24">
            <div className="animate-in fade-in slide-in-from-bottom-3 relative motion-reduce:animate-none duration-700">
              <h1 className="text-[2.6rem] font-semibold leading-[1.04] tracking-tight sm:text-5xl lg:text-[3.5rem]">
                {t("hero")}
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                {t("heroBody")}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/search"
                  className={cn(buttonVariants({ size: "lg" }), "min-h-12 h-auto whitespace-normal py-3 gap-2 px-6 text-[15px]")}
                >
                  {t("find")}
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="#how-it-works"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-12 h-auto whitespace-normal py-3 px-6 text-[15px]")}
                >
                  {t("seeHow")}
                </Link>
              </div>
              <Link href="/goodwill" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium underline underline-offset-4">{t("browse")} <ArrowRight className="size-4 rtl:rotate-180" /></Link>
              <p className="mt-3 text-[13px] text-muted-foreground">
                {t("free")}
              </p>
            </div>

            {/* Hero preview */}
            <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both relative delay-150 duration-700">

              <PreviewPanel />
            </div>
          </div>
        </section>

        {/* Insight */}
        <section className="border-y border-border bg-card/50">
          <div className="reveal mx-auto max-w-6xl px-5 py-16">
            <h2 className="sr-only">{t("plan")}</h2>
            <div className="grid gap-10 sm:grid-cols-3">
              {[0, 1, 2].map((s) => (
                <div key={s}>
                  <span className="tabular block text-2xl font-semibold tracking-tight text-[var(--brand)]">
                    {String(s + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2.5 text-lg font-semibold">{t(`step${s}Title`)}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{t(`step${s}Body`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How the score works */}
        <section id="how-it-works" className="scroll-mt-16">
          <div className="reveal mx-auto max-w-6xl px-5 py-20">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("scoreHow")}
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                {t("scoreIntro")}
              </p>
            </div>

            <div className="mt-10 grid gap-x-10 sm:grid-cols-2">
              {ORDER.map((key) => {
                const Icon = FACTOR_ICONS[key];
                const color = scoreColor(60 + WEIGHTS[key] * 90);
                return (
                  <div
                    key={key}
                    className="flex gap-4 border-t border-border py-6"
                  >
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`, color }}
                    >
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{t(`factor_${key}`)}</h3>
                        <span className="tabular rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          {t("weight", {value: Math.round(WEIGHTS[key] * 100)})}
                        </span>
                      </div>
                      <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
                        {t(`factorBody_${key}`)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Features */}
            <div className="mt-12 grid gap-x-10 gap-y-8 border-t border-border pt-8 sm:grid-cols-2">
              {FEATURES.map((Icon, i) => (
                <div
                  key={i}
                  className="relative ps-14"
                >
                  <span className="absolute start-0 top-0 flex size-10 items-center justify-center text-[var(--brand)]">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="font-semibold">{t(`feature${i}Title`)}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{t(`feature${i}Body`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Browse by city */}
        <section className="border-t border-border">
          <div className="reveal mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("browse")}
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              {t("browseIntro")}
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              {POPULAR_CITY_SLUGS.map((slug) => {
                const c = getCity(slug);
                if (!c) return null;
                return (
                  <Link
                    key={slug}
                    href={`/goodwill/${slug}`}
                    className="rounded-full border border-border bg-card px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                  >
                    {c.city}, {c.state}
                  </Link>
                );
              })}
              <Link
                href="/goodwill"
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-[13px] font-medium text-background"
              >
                {t("allStates")}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-5 pb-20">
          <div className="reveal relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-foreground px-8 py-16 text-center text-background sm:py-20">
            {/* Subtle emerald glow + grid for depth, tied to the brand color. */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.16]"
              style={{ background: "radial-gradient(ellipse 55% 75% at 50% 0%, var(--brand), transparent)" }}
            />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("cta")}
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-background/70">
                {t("ctaBody")}
              </p>
              <Link
                href="/search"
                className={cn(buttonVariants({ size: "lg", variant: "secondary" }), "mt-8 min-h-12 h-auto whitespace-normal py-3 gap-2 px-6 text-[15px]")}
              >
                {t("locator")}
                <ArrowRight className="size-4" />
              </Link>
            </div>
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
              <GithubMark className="size-3.5" />
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
            </a>{" "}
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
      </footer>
    </div>
  );
}

/** Static, on-brand preview of the ranked list for the hero. */
async function PreviewPanel() {
  const t = await getTranslations("pages");
  const sample = [
    { rank: 1, score: 89, title: "La Jolla", street: "7631 Girard Avenue", dist: 0.3, open: true, best: true },
    { rank: 2, score: 76, title: "Pacific Beach", street: "Garnet Avenue", dist: 3.1, open: true, best: false },
    { rank: 3, score: 61, title: "Clairemont", street: "Clairemont Mesa Blvd", dist: 5.4, open: false, best: false },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
        <span className="text-[12px] font-medium text-muted-foreground">{t("example")}</span>
        <span className="tabular text-[12px] text-muted-foreground">{t("ranked", {count: 3})}</span>
      </div>
      <div className="divide-y divide-border">
        {sample.map((s) => {
          const color = scoreColor(s.score);
          return (
            <div
              key={s.rank}
              className="relative overflow-hidden p-5"
            >
              {s.best && <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: color }} />}
              <div className="flex items-center gap-3.5">
                <ScoreRing score={s.score} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="tabular text-[11px] font-medium text-muted-foreground">#{s.rank}</span>
                    {s.best && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background">
                        <Crown className="size-2.5" />
                        {t("highest")}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[15px] font-semibold leading-tight">{s.title}</p>
                  <p className="truncate text-[12px] text-muted-foreground">{s.street}</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    <span className="tabular">{t("away", {distance: s.dist})}</span>

                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
