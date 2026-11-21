import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Search } from "lucide-react";
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
      <div className="site-gutter mx-auto flex min-h-14 max-w-5xl items-center justify-between gap-2 py-2">
        <Wordmark />
        <nav className="flex items-center justify-end gap-1 sm:gap-2">
          <LanguageSwitcher />
          <GithubLink className="hidden lg:inline-flex" />
          <CoffeeLink className="hidden lg:inline-flex" />
          <ThemeToggle />
          <Link href="/search" className={cn(buttonVariants({ size: "sm" }), "size-11 gap-1.5 p-0 sm:w-auto sm:px-3.5")}>
            <Search className="size-4 sm:hidden" aria-hidden />
            <span className="sr-only sm:not-sr-only">{t("launch")}</span>
            <ArrowRight className="hidden size-3.5 sm:block rtl:rotate-180" aria-hidden />
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** Shared footer for the static, SEO-facing pages. */
export function CityFooter() {
  const t = useTranslations("ui");
  const d = useTranslations("directory");
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2"><Wordmark /><Link href="/how-we-score">{t("howScoreStores")}</Link><Link href="/thrift-stores">{d("allStores")}</Link><div className="flex gap-4"><Link href="/privacy">{d("privacy")}</Link><Link href="/terms">{d("terms")}</Link></div></div>
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
