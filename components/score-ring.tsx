import { useTranslations, useLocale } from "next-intl";
import { scoreColor } from "@/lib/score-color";

interface Props {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ScoreRing({ score, size = 60, strokeWidth = 5, className }: Props) {
  const t = useTranslations("ui");
  const locale = useLocale();
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color = scoreColor(score);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={t("scoreAria", { score: Math.round(score) })}
      className={`block shrink-0 ${className ?? ""}`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        className="stroke-muted"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)" }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground font-semibold tabular"
        style={{ fontSize: size * 0.34, letterSpacing: "-0.02em" }}
      >
        {new Intl.NumberFormat(locale, {numberingSystem: locale === "ar" ? "arab" : "latn"}).format(Math.round(score))}
      </text>
    </svg>
  );
}
