import { CityHeader, CityFooter } from "@/components/city/chrome";
import { ScrollToTop } from "@/components/scroll-to-top";

// Shown instantly while a city page renders (or its ISR cache warms), so a
// click gives immediate feedback instead of looking frozen.
export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollToTop />
      <CityHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-5 h-10 w-3/4 animate-pulse rounded-lg bg-muted" />
          <div className="mt-4 space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="h-11 w-56 animate-pulse rounded-lg bg-muted" />
            <div className="h-11 w-40 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="mt-12 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5"
              >
                <div className="size-12 shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <CityFooter />
    </div>
  );
}
