import type { GoodsScore } from "@/lib/types";
import { scoreColor, FACTOR_LABELS } from "@/lib/score-color";
import { formatCurrency, formatPercent, formatPopulation } from "@/lib/format";

function fmt(key: string, value: number | null): string {
  if (value == null) return "—";
  if (key === "pctBachelorsPlus") return formatPercent(value);
  if (key === "medianGrossRent") return formatCurrency(value, { perMonth: true });
  return formatCurrency(value);
}

export function ScoreBreakdown({ score }: { score: GoodsScore }) {
  const keys = Object.keys(score.factors) as Array<keyof GoodsScore["factors"]>;
  return (
    <div className="space-y-2.5">
      {keys.map((key) => {
        const f = score.factors[key];
        return (
          <div key={key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="text-muted-foreground">{FACTOR_LABELS[key]}</span>
              <span className="font-medium tabular">{fmt(key, f.value)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${f.normalized}%`, backgroundColor: scoreColor(f.normalized) }}
              />
            </div>
          </div>
        );
      })}
      <p className="pt-0.5 text-[11px] leading-relaxed text-muted-foreground">
        Blended from {score.catchment.tractCount} nearby census tract
        {score.catchment.tractCount === 1 ? "" : "s"}
        {score.catchment.population > 0 && (
          <> · ~{formatPopulation(score.catchment.population)} residents</>
        )}
      </p>
    </div>
  );
}
