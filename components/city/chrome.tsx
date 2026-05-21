import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { GithubLink, GithubMark, REPO_URL } from "@/components/github-link";
import { CoffeeLink } from "@/components/coffee-link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shared header for the static, SEO-facing pages (hub + city). */
export function CityHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
        <Wordmark />
        <nav className="flex items-center gap-1 sm:gap-2">
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
  );
}

/** Shared footer for the static, SEO-facing pages. */
export function CityFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <Wordmark />
        <p className="max-w-md leading-relaxed">
          Scores estimate donation quality from U.S. Census neighborhood data, not live inventory.
          Store coverage comes from OpenStreetMap and may be incomplete.{" "}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
          >
            <GithubMark className="size-3" />
            Open source
          </a>
        </p>
      </div>
    </footer>
  );
}
