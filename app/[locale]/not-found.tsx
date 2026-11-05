import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function NotFound() {
  const t = await getTranslations("pages");
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
            {t("notFound")}
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("notFoundTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            {t("notFoundBody")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/search"
              className={cn(buttonVariants({ size: "lg" }), "min-h-12 h-auto whitespace-normal py-3 gap-2 px-6 text-[15px]")}
            >
              <Search className="size-4" />
              {t("searchMap")}
            </Link>
            <Link
              href="/goodwill"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-12 h-auto whitespace-normal py-3 gap-2 px-6 text-[15px]")}
            >
              {t("browseStates")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
