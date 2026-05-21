import Link from "next/link";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-5">
          <Wordmark />
        </div>
      </header>

      <main className="relative flex flex-1 items-center overflow-hidden">
        <div
          className="bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_55%_50%_at_50%_30%,black,transparent)]"
        />
        <div className="relative mx-auto w-full max-w-xl px-5 py-20 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[12px] font-medium text-muted-foreground">
            <MapPin className="size-3.5 text-[var(--brand)]" />
            Page not found
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            We don&apos;t have a page for{" "}
            <span className="text-[var(--brand)]">that one.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            We may not have a dedicated page for that city yet — but you can still find every Goodwill
            near any address on the live map, ranked by where the good stuff is.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/search"
              className={cn(buttonVariants({ size: "lg" }), "h-12 gap-2 px-6 text-[15px]")}
            >
              <Search className="size-4" />
              Search the live map
            </Link>
            <Link
              href="/goodwill"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 gap-2 px-6 text-[15px]")}
            >
              Browse by state
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
