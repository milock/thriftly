// Value scale for the Goods Score. Interpolated in OKLCH (perceptually even, no
// muddy olive/brown midpoints) and converted to sRGB so it renders identically in
// CSS, inline SVG attributes, and Leaflet marker fills.

interface Stop {
  at: number;
  l: number;
  c: number;
  h: number;
}

// Lightness stays high through the amber/lime midrange so it reads golden, never brown.
const STOPS: Stop[] = [
  { at: 0, l: 0.7, c: 0.085, h: 25 }, // soft coral
  { at: 35, l: 0.765, c: 0.115, h: 65 }, // golden amber
  { at: 55, l: 0.79, c: 0.13, h: 120 }, // fresh lime
  { at: 75, l: 0.695, c: 0.15, h: 150 }, // green
  { at: 100, l: 0.575, c: 0.155, h: 158 }, // deep emerald
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function oklchToRgb(L: number, C: number, H: number): string {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const gamma = (x: number) =>
    x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055;
  const to255 = (x: number) => Math.max(0, Math.min(255, Math.round(gamma(x) * 255)));
  return `rgb(${to255(lr)}, ${to255(lg)}, ${to255(lb)})`;
}

function interp(score: number): { L: number; C: number; H: number } {
  const s = Math.max(0, Math.min(100, score));
  let lo = STOPS[0];
  let hi = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (s >= STOPS[i].at && s <= STOPS[i + 1].at) {
      lo = STOPS[i];
      hi = STOPS[i + 1];
      break;
    }
  }
  const t = (s - lo.at) / (hi.at - lo.at || 1);
  return { L: lerp(lo.l, hi.l, t), C: lerp(lo.c, hi.c, t), H: lerp(lo.h, hi.h, t) };
}

export function scoreColor(score: number): string {
  const { L, C, H } = interp(score);
  return oklchToRgb(L, C, H);
}

/** Readable text color to place on a scoreColor fill (dark on light pins, white on dark). */
export function scoreInk(score: number): string {
  return interp(score).L > 0.66 ? "#1c1917" : "#ffffff";
}

export interface ScoreTier {
  label: string;
  blurb: string;
}

/** Human label for a score, so meaning is conveyed by words, not color alone. */
export function scoreTier(score: number): ScoreTier {
  if (score >= 82) return { label: "Prime", blurb: "Top-tier donations nearby" };
  if (score >= 68) return { label: "Excellent", blurb: "Affluent catchment area" };
  if (score >= 52) return { label: "Strong", blurb: "Comfortable surrounding area" };
  if (score >= 36) return { label: "Fair", blurb: "Mixed-income catchment" };
  return { label: "Lean", blurb: "Modest surrounding area" };
}

export const FACTOR_LABELS: Record<string, string> = {
  medianHomeValue: "Median home value",
  medianHouseholdIncome: "Median income",
  pctBachelorsPlus: "College-educated",
  medianGrossRent: "Median rent",
};

export const FACTOR_BLURB: Record<string, string> = {
  medianHomeValue: "Higher property values signal more disposable income — and better cast-offs.",
  medianHouseholdIncome: "Wealthier households donate higher-quality goods more often.",
  pctBachelorsPlus: "Education correlates with brand-name and well-kept donations.",
  medianGrossRent: "Captures affluence in renter-heavy areas home value misses.",
};
