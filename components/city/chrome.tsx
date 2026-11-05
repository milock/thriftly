import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { GithubLink, GithubMark, REPO_URL } from "@/components/github-link";
import { CoffeeLink } from "@/components/coffee-link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shared header for the static, SEO-facing pages (hub + city). */
export function CityHeader() {
  const t = useTranslations("ui");
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-5">
        <Wordmark />
        <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
          <LanguageSwitcher />
          <GithubLink className="hidden sm:inline-flex" />
          <CoffeeLink className="hidden sm:inline-flex" />
          <ThemeToggle />
          <Link href="/search" className={cn(buttonVariants({ size: "sm" }), "h-11 gap-1.5 px-3.5")}>
            {t("launch")}
            <ArrowRight className="size-3.5" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** Shared footer for the static, SEO-facing pages. */
export function CityFooter() {
  const t = useTranslations("ui");
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2"><Wordmark /><Link href="/how-we-score">{t("howScoreStores")}</Link></div>
        <p className="max-w-md leading-relaxed">
          {t("footer")}{" "}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
          >
            <GithubMark className="size-3" />
            {t("source")}
          </a>
        </p>
      </div>
    </footer>
  );
}
