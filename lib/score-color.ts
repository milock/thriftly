// 0..100 → hsl color string (red ~0, amber ~50, green ~100).
export function scoreColor(score: number): string {
  const clamped = Math.max(0, Math.min(100, score));
  const hue = (clamped / 100) * 120; // 0=red, 120=green
  return `hsl(${hue}, 70%, 45%)`;
}

export const FACTOR_LABELS: Record<string, string> = {
  medianHomeValue: "Home value",
  medianHouseholdIncome: "Household income",
  pctBachelorsPlus: "College-educated",
  medianGrossRent: "Gross rent",
};
