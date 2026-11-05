import { useTranslations, useLocale } from "next-intl";
import type { GoodsScore } from "@/lib/types";
import { scoreColor } from "@/lib/score-color";
import { formatCurrency, formatPercent } from "@/lib/format";

export function ScoreBreakdown({ score }: { score: GoodsScore }) {
  const t = useTranslations("ui");
  const locale = useLocale();
  if (score.catchment.tractCount === 0) return <p className="text-sm text-muted-foreground">{t("notScored")}</p>;
  const keys = Object.keys(score.factors) as Array<keyof GoodsScore["factors"]>;
  return (
    <div className="space-y-3 border-t border-border pt-4">
      {keys.map((key) => {
        const f = score.factors[key];
        return (
          <div key={key} className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[13px]">
              <span className="text-muted-foreground">{t(key)}</span>
              <span className="tabular ms-auto max-w-full break-words font-medium">{f.value == null ? "—" : key === "pctBachelorsPlus" ? formatPercent(f.value, locale) : key === "medianGrossRent" ? t("monthly", { amount: formatCurrency(f.value, { locale }) }) : formatCurrency(f.value, { locale })}</span>
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
        {t("tracts", { count: score.catchment.tractCount })}
        {score.catchment.population > 0 && <> · {t("residents", { count: score.catchment.population })}</>}
      </p>
    </div>
  );
}
