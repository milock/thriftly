import type { GoodsScore } from "@/lib/types";
import { scoreColor, FACTOR_LABELS } from "@/lib/score-color";

function fmt(key: string, value: number | null): string {
  if (value == null) return "n/a";
  if (key === "pctBachelorsPlus") return `${value.toFixed(0)}%`;
  if (key === "medianGrossRent") return `$${Math.round(value).toLocaleString()}/mo`;
  return `$${Math.round(value).toLocaleString()}`;
}

export function ScoreBreakdown({ score }: { score: GoodsScore }) {
  return (
    <div className="space-y-2">
      {(Object.keys(score.factors) as Array<keyof GoodsScore["factors"]>).map((key) => {
        const f = score.factors[key];
        return (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{FACTOR_LABELS[key]}</span>
              <span className="font-medium">{fmt(key, f.value)}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div className="h-1.5 rounded-full" style={{ width: `${f.normalized}%`, backgroundColor: scoreColor(f.normalized) }} />
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-[11px] text-muted-foreground">
        Blended from {score.catchment.tractCount} nearby tract
        {score.catchment.tractCount === 1 ? "" : "s"} (~{score.catchment.population.toLocaleString()} residents).
      </p>
    </div>
  );
}
