import Link from "next/link";
import {
  ArrowRight,
  Home,
  Wallet,
  GraduationCap,
  KeyRound,
  Navigation,
  Clock,
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
import { FACTOR_LABELS, FACTOR_BLURB, scoreColor } from "@/lib/score-color";
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

const FEATURES = [
  { icon: Sparkles, title: "Ranked by real data", body: "Every store gets a 0–100 Goods Score from Census affluence data — no guesswork." },
  { icon: MapPinned, title: "Live map", body: "See every nearby Goodwill as a color-graded pin, with your search radius drawn in." },
  { icon: Navigation, title: "Directions & hours", body: "One tap to Google Maps directions, store hours, phone, and website." },
  { icon: SlidersHorizontal, title: "Powerful filters", body: "Dial radius from a half-mile to 100, set a minimum score, or show only what's open." },
];

export default function Landing() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Wordmark />
          <nav className="flex items-center gap-1 sm:gap-3">
            <Link
              href="#how-it-works"
              className="hidden rounded-md px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              How it works
            </Link>
            <GithubLink />
            <CoffeeLink />
            <ThemeToggle />
            <Link href="/search" className={cn(buttonVariants({ size: "sm" }), "h-9 gap-1.5 px-3.5")}>
              Launch app
              <ArrowRight className="size-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)] opacity-70" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28 lg:pt-24">
            <div className="animate-in fade-in slide-in-from-bottom-3 relative duration-700">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[12px] font-medium text-muted-foreground">
                <Sparkles className="size-3.5" />
                Built on U.S. Census + OpenStreetMap
              </span>
              <h1 className="mt-5 text-[2.6rem] font-semibold leading-[1.04] tracking-tight sm:text-5xl lg:text-[3.5rem]">
                Find the Goodwill with the best&nbsp;stuff.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Thrift stores in wealthier neighborhoods get better donations. We score every
                Goodwill near you by the affluence of its surrounding area — so you hunt where the
                treasure actually is.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/search"
                  className={cn(buttonVariants({ size: "lg" }), "h-12 gap-2 px-6 text-[15px]")}
                >
                  Find stores near me
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="#how-it-works"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 px-6 text-[15px]")}
                >
                  See how it works
                </Link>
              </div>
              <p className="mt-5 text-[13px] text-muted-foreground">
                Free · No sign-up · Open source
              </p>
            </div>

            {/* Hero preview */}
            <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both relative delay-150 duration-700">
              <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-muted/60 to-transparent blur-2xl" />
              <PreviewPanel />
            </div>
          </div>
        </section>

        {/* Insight */}
        <section className="border-y border-border bg-card/50">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="grid gap-10 sm:grid-cols-3">
              {[
                { n: "01", t: "We map every Goodwill near you", b: "Pulled live from OpenStreetMap within your chosen radius." },
                { n: "02", t: "We read the neighborhood", b: "U.S. Census data for the census tracts around each store — income, home value, education, rent." },
                { n: "03", t: "We score it 0–100", b: "A weighted, distance-blended Goods Score tells you where the best donations land." },
              ].map((s) => (
                <div key={s.n}>
                  <span className="tabular text-[13px] font-semibold text-muted-foreground">{s.n}</span>
                  <h3 className="mt-2 text-lg font-semibold">{s.t}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{s.b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How the score works */}
        <section id="how-it-works" className="scroll-mt-16">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                How the Goods Score works
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                For each store we blend the demographics of every census tract within about three
                miles — weighted by population and distance — then score four signals of local
                affluence:
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {ORDER.map((key) => {
                const Icon = FACTOR_ICONS[key];
                const color = scoreColor(60 + WEIGHTS[key] * 90);
                return (
                  <div
                    key={key}
                    className="flex gap-4 rounded-2xl border border-border bg-card p-5"
                  >
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`, color }}
                    >
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{FACTOR_LABELS[key]}</h3>
                        <span className="tabular rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          {Math.round(WEIGHTS[key] * 100)}% weight
                        </span>
                      </div>
                      <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
                        {FACTOR_BLURB[key]}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Features */}
            <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl border border-border bg-card p-5">
                  <f.icon className="size-5 text-foreground" />
                  <h3 className="mt-3 font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-5 pb-20">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-foreground px-8 py-16 text-center text-background sm:py-20">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Your next great thrift run starts here.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-background/70">
              Drop in a ZIP code and see every Goodwill nearby, ranked by where the good stuff is.
            </p>
            <Link
              href="/search"
              className={cn(buttonVariants({ size: "lg", variant: "secondary" }), "mt-8 h-12 gap-2 px-6 text-[15px]")}
            >
              Launch the locator
              <ArrowRight className="size-4" />
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
              <GithubMark className="size-3.5" />
              Open source on GitHub
            </a>
          </div>
          <p className="max-w-md leading-relaxed">
            Data from the{" "}
            <a
              href="https://www.census.gov/programs-surveys/acs"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              U.S. Census Bureau (ACS)
            </a>{" "}
            and{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              OpenStreetMap
            </a>
            . The Goods Score estimates donation quality, not live inventory, and store coverage
            may be incomplete.
          </p>
        </div>
      </footer>
    </div>
  );
}

/** Static, on-brand preview of the ranked list for the hero. */
function PreviewPanel() {
  const sample = [
    { rank: 1, score: 89, title: "La Jolla", street: "7631 Girard Avenue", dist: "0.3 mi", open: true, best: true },
    { rank: 2, score: 76, title: "Pacific Beach", street: "Garnet Avenue", dist: "3.1 mi", open: true, best: false },
    { rank: 3, score: 61, title: "Clairemont", street: "Clairemont Mesa Blvd", dist: "5.4 mi", open: false, best: false },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-xl shadow-black/[0.06]">
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-[12px] font-medium text-muted-foreground">Goodwills near La Jolla, CA</span>
        <span className="tabular text-[12px] text-muted-foreground">3 ranked</span>
      </div>
      <div className="space-y-2">
        {sample.map((s) => {
          const color = scoreColor(s.score);
          return (
            <div
              key={s.rank}
              className="relative overflow-hidden rounded-xl border border-border bg-background p-3.5"
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
                        Best find
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[15px] font-semibold leading-tight">{s.title}</p>
                  <p className="truncate text-[12px] text-muted-foreground">{s.street}</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    <span className="tabular">{s.dist} away</span>
                    {" · "}
                    <span style={s.open ? { color: "var(--brand)", fontWeight: 500 } : undefined}>
                      {s.open ? "Open now" : "Closed"}
                    </span>
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
