/**
 * Subtle meteor-shower backdrop for a hero surface. Deterministic positions
 * (no Math.random) so it server-renders without a hydration mismatch; purely
 * decorative (aria-hidden) and disabled under prefers-reduced-motion via CSS.
 */
export function Meteors({ count = 16 }: { count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: count }).map((_, i) => {
        // Spread starting points across the top edge with a little vertical jitter,
        // and vary delay/duration so the streaks don't move in lockstep.
        const left = `${(i * 97) % 100}%`;
        const top = `${-((i * 37) % 60)}px`;
        const delay = `${((i * 1.7) % 9).toFixed(2)}s`;
        const duration = `${5 + ((i * 13) % 6)}s`;
        return (
          <span
            key={i}
            className="meteor"
            style={{ left, top, animationDelay: delay, animationDuration: duration }}
          />
        );
      })}
    </div>
  );
}
