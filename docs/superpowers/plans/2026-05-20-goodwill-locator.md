# Goodwill Locator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js webapp that finds Goodwill stores within a radius of the user and ranks them by a documented "Goods Score" (catchment-area affluence), with a per-factor breakdown, robust filters, and a synced map + list.

**Architecture:** On-demand server orchestration. A single Route Handler (`/api/stores`) fans out to free/open data sources (OpenStreetMap Overpass for stores, U.S. Census ACS for demographics, a bundled Census Gazetteer for tract centroids), blends nearby census tracts into a per-store catchment, scores each store with a pure scoring module, and returns a sorted list. The client renders a filterable list + Leaflet map. Pure logic (`scoring`, `catchment`, `distance`) is fully unit-tested; data clients are tested with mocked `fetch`.

**Tech Stack:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui · react-leaflet + Leaflet + OSM tiles · Vitest · deployed to Vercel.

**Spec:** `docs/superpowers/specs/2026-05-20-goodwill-locator-design.md`

**Working directory:** `~/Documents/goodwill-locator/` (fresh git repo; only the spec is committed). All paths below are relative to this directory unless absolute.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/types.ts` | Shared TypeScript interfaces (`LatLng`, `Store`, `TractDemographics`, `GoodsScore`, `ScoredStore`, …) |
| `lib/reference-ranges.ts` | National normalization ranges + composite weights (single source of truth) |
| `lib/distance.ts` | Haversine distance in miles |
| `lib/scoring.ts` | Pure: blended demographics → `GoodsScore` (normalize + composite + breakdown) |
| `lib/catchment.ts` | Pure: select tracts in radius + inverse-distance × population weighting |
| `lib/gazetteer.ts` | Load per-state tract centroids from bundled `data/tract-centroids/{stateFips}.json` |
| `lib/overpass.ts` | Fetch Goodwill stores from Overpass API (cached) |
| `lib/census.ts` | Fetch per-county tract demographics from Census ACS (cached) |
| `lib/geocode.ts` | Address/ZIP → `LatLng`; point → state FIPS (Census Geocoder + Nominatim fallback) |
| `app/api/stores/route.ts` | Orchestration: stores → catchment → score → sorted `ScoredStore[]` |
| `app/api/geocode/route.ts` | Thin server wrapper around `geocodeAddress` |
| `lib/use-stores.ts` | Client hook: query params/filters → fetch `/api/stores` → state |
| `lib/filters.ts` | Filter/sort state shape + pure `applyFilters` |
| `lib/score-color.ts` | 0–100 → color + factor labels (shared by ring, breakdown, markers) |
| `components/location-search.tsx` | "Use my location" + address input |
| `components/filter-panel.tsx` | Radius, min score, open-now, sort |
| `components/score-ring.tsx` | Circular 0–100 score indicator (color-graded) |
| `components/score-breakdown.tsx` | Per-factor value / normalized bar + catchment context |
| `components/store-card.tsx` | One store: name, score ring, distance, factor bars |
| `components/store-list.tsx` | Sorted, filtered list of `store-card`s |
| `components/map/store-map.tsx` | Leaflet map (client-only) with color-graded markers + popups |
| `app/page.tsx` | Assembles search + filters + list + map; responsive (tabs on mobile) |
| `scripts/build-centroids.mjs` | One-time: parse Census Gazetteer, split tract centroids by state FIPS |

---

### Task 1: Scaffold Next.js into the existing repo

**Files:**
- Create: entire Next.js app skeleton (preserving existing `.git` and `docs/`)

The project dir already has `.git` + `docs/`, which `create-next-app` treats as conflicts. Scaffold in a temp dir and merge in, excluding the temp's git.

- [ ] **Step 1: Scaffold in a temp sibling directory**

```bash
cd ~/Documents
npx create-next-app@latest goodwill-locator-tmp \
  --ts --tailwind --eslint --app --no-src-dir \
  --import-alias "@/*" --use-npm --yes
```
Expected: `goodwill-locator-tmp/` created with `app/`, `package.json`, `tailwind`/`postcss` config, `tsconfig.json`.

- [ ] **Step 2: Merge generated files into the repo (keep existing .git + docs)**

```bash
rsync -a --exclude='.git' goodwill-locator-tmp/ goodwill-locator/
rm -rf goodwill-locator-tmp
cd ~/Documents/goodwill-locator
ls app package.json tsconfig.json
```
Expected: files present; `.git/` and `docs/` still intact (`git log --oneline` shows the spec commit).

- [ ] **Step 3: Verify build runs**

```bash
cd ~/Documents/goodwill-locator && npm run build
```
Expected: build succeeds (default Next starter compiles).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app (App Router, TS, Tailwind)"
```

---

### Task 2: Initialize shadcn/ui and add components

**Files:**
- Create: `components.json`, `components/ui/*`, `lib/utils.ts`

- [ ] **Step 1: Init shadcn**

```bash
cd ~/Documents/goodwill-locator
npx shadcn@latest init -d
```
Expected: `components.json` created, `lib/utils.ts` with `cn()` helper, Tailwind tokens added to `app/globals.css`. (`-d` accepts defaults.)

- [ ] **Step 2: Add the component set the UI needs**

```bash
npx shadcn@latest add card slider select badge sheet tabs button skeleton tooltip separator switch label input
```
Expected: files under `components/ui/` (card, slider, select, badge, sheet, tabs, button, skeleton, tooltip, separator, switch, label, input).

- [ ] **Step 3: Verify it still builds**

```bash
npm run build
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: init shadcn/ui and add base components"
```

---

### Task 3: Set up Vitest

**Files:**
- Create: `vitest.config.ts`, `__tests__/smoke.test.ts`
- Modify: `package.json` (add `test` scripts)

- [ ] **Step 1: Install Vitest**

```bash
cd ~/Documents/goodwill-locator
npm install -D vitest
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 3: Add the test scripts to `package.json`**

In the `"scripts"` block add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write a smoke test** — `__tests__/smoke.test.ts`

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: 1 passing test.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: set up Vitest"
```

---

### Task 4: Shared types and reference ranges

**Files:**
- Create: `lib/types.ts`, `lib/reference-ranges.ts`

- [ ] **Step 1: Create `lib/types.ts`**

```ts
export interface LatLng {
  lat: number;
  lon: number;
}

export interface Store {
  id: string; // e.g. "node/123456"
  name: string;
  location: LatLng;
  address?: string;
  openingHours?: string;
  website?: string;
  phone?: string;
}

export interface TractCentroid {
  geoid: string; // 11-digit: SS CCC TTTTTT
  lat: number;
  lon: number;
}

export interface TractDemographics {
  geoid: string;
  medianHomeValue: number | null;
  medianHouseholdIncome: number | null;
  medianGrossRent: number | null;
  population: number | null;
  pctBachelorsPlus: number | null;
}

/** Catchment-blended demographics for a single store. */
export interface CatchmentDemographics {
  medianHomeValue: number | null;
  medianHouseholdIncome: number | null;
  medianGrossRent: number | null;
  pctBachelorsPlus: number | null;
  tractCount: number;
  population: number;
}

export type FactorKey =
  | "medianHomeValue"
  | "medianHouseholdIncome"
  | "pctBachelorsPlus"
  | "medianGrossRent";

export interface FactorScore {
  value: number | null; // raw blended value
  normalized: number; // 0..100
  weight: number; // 0..1
  contribution: number; // points toward total (normalized * weight)
}

export interface GoodsScore {
  total: number; // 0..100
  factors: Record<FactorKey, FactorScore>;
  catchment: { tractCount: number; population: number };
}

export interface ScoredStore extends Store {
  distanceMiles: number;
  score: GoodsScore;
}

export interface StoreQuery {
  lat: number;
  lon: number;
  radiusMiles: number;
}
```

- [ ] **Step 2: Create `lib/reference-ranges.ts`**

```ts
import type { FactorKey } from "@/lib/types";

export interface RefRange {
  min: number;
  max: number;
  log?: boolean;
}

/** National normalization ranges. Tunable single source of truth. */
export const REFERENCE_RANGES: Record<FactorKey, RefRange> = {
  medianHomeValue: { min: 100_000, max: 1_500_000, log: true },
  medianHouseholdIncome: { min: 25_000, max: 200_000 },
  pctBachelorsPlus: { min: 0, max: 70 },
  medianGrossRent: { min: 700, max: 3_000 },
};

/** Composite weights (sum to 1.0). */
export const WEIGHTS: Record<FactorKey, number> = {
  medianHomeValue: 0.4,
  medianHouseholdIncome: 0.35,
  pctBachelorsPlus: 0.15,
  medianGrossRent: 0.1,
};

/** Catchment radius (miles) around a store whose tracts feed its score. */
export const CATCHMENT_RADIUS_MILES = 3;
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: shared types and reference ranges"
```

---

### Task 5: Distance utility (TDD)

**Files:**
- Create: `lib/distance.ts`, `__tests__/distance.test.ts`

- [ ] **Step 1: Write the failing test** — `__tests__/distance.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { haversineMiles } from "@/lib/distance";

describe("haversineMiles", () => {
  it("is ~0 for identical points", () => {
    expect(haversineMiles({ lat: 32.7, lon: -117.1 }, { lat: 32.7, lon: -117.1 })).toBeCloseTo(0, 5);
  });

  it("matches a known distance (San Diego → LA ≈ 110.8 mi)", () => {
    const sd = { lat: 32.7157, lon: -117.1611 };
    const la = { lat: 34.0522, lon: -118.2437 };
    expect(haversineMiles(sd, la)).toBeGreaterThan(108);
    expect(haversineMiles(sd, la)).toBeLessThan(114);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- distance`
Expected: FAIL ("Cannot find module" / `haversineMiles` is not defined).

- [ ] **Step 3: Implement** — `lib/distance.ts`

```ts
import type { LatLng } from "@/lib/types";

const EARTH_RADIUS_MILES = 3958.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- distance`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: haversine distance utility"
```

---

### Task 6: Scoring module (TDD)

**Files:**
- Create: `lib/scoring.ts`, `__tests__/scoring.test.ts`

Scoring: `normalize` maps a raw value to 0–100 against its range (log-scaled for home value). `computeGoodsScore` normalizes each factor, multiplies by its weight for a contribution, and sums to the total. A missing factor (`null`) contributes 0 (documented; catchment blending makes nulls rare).

- [ ] **Step 1: Write the failing test** — `__tests__/scoring.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { normalize, computeGoodsScore } from "@/lib/scoring";
import { REFERENCE_RANGES } from "@/lib/reference-ranges";
import type { CatchmentDemographics } from "@/lib/types";

describe("normalize", () => {
  it("clamps below min to 0 and above max to 100", () => {
    expect(normalize(0, REFERENCE_RANGES.medianHouseholdIncome)).toBe(0);
    expect(normalize(500_000, REFERENCE_RANGES.medianHouseholdIncome)).toBe(100);
  });

  it("returns 0 for null", () => {
    expect(normalize(null, REFERENCE_RANGES.medianHouseholdIncome)).toBe(0);
  });

  it("is monotonic on a log-scaled range (home value)", () => {
    const lo = normalize(200_000, REFERENCE_RANGES.medianHomeValue);
    const hi = normalize(900_000, REFERENCE_RANGES.medianHomeValue);
    expect(hi).toBeGreaterThan(lo);
    expect(lo).toBeGreaterThan(0);
    expect(hi).toBeLessThan(100);
  });
});

describe("computeGoodsScore", () => {
  const wealthy: CatchmentDemographics = {
    medianHomeValue: 1_300_000, medianHouseholdIncome: 180_000,
    medianGrossRent: 2_800, pctBachelorsPlus: 65, tractCount: 4, population: 18_000,
  };
  const poor: CatchmentDemographics = {
    medianHomeValue: 150_000, medianHouseholdIncome: 35_000,
    medianGrossRent: 900, pctBachelorsPlus: 12, tractCount: 3, population: 14_000,
  };

  it("scores a wealthy catchment higher than a poor one", () => {
    expect(computeGoodsScore(wealthy).total).toBeGreaterThan(computeGoodsScore(poor).total);
  });

  it("keeps total within 0..100 and equal to the sum of contributions", () => {
    const s = computeGoodsScore(wealthy);
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(s.total).toBeLessThanOrEqual(100);
    const sum =
      s.factors.medianHomeValue.contribution +
      s.factors.medianHouseholdIncome.contribution +
      s.factors.pctBachelorsPlus.contribution +
      s.factors.medianGrossRent.contribution;
    expect(s.total).toBeCloseTo(sum, 1);
  });

  it("treats a missing factor as a 0 contribution", () => {
    const s = computeGoodsScore({ ...wealthy, medianGrossRent: null });
    expect(s.factors.medianGrossRent.contribution).toBe(0);
    expect(s.factors.medianHomeValue.contribution).toBeGreaterThan(0);
  });

  it("passes catchment meta through", () => {
    const s = computeGoodsScore(wealthy);
    expect(s.catchment).toEqual({ tractCount: 4, population: 18_000 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- scoring`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `lib/scoring.ts`

```ts
import type {
  CatchmentDemographics, FactorKey, FactorScore, GoodsScore,
} from "@/lib/types";
import { REFERENCE_RANGES, WEIGHTS, type RefRange } from "@/lib/reference-ranges";

export function normalize(value: number | null, range: RefRange): number {
  if (value == null || Number.isNaN(value)) return 0;
  let v = value;
  let min = range.min;
  let max = range.max;
  if (range.log) {
    v = Math.log(Math.max(value, 1));
    min = Math.log(range.min);
    max = Math.log(range.max);
  }
  const t = (v - min) / (max - min);
  return Math.max(0, Math.min(100, t * 100));
}

const FACTOR_KEYS: FactorKey[] = [
  "medianHomeValue", "medianHouseholdIncome", "pctBachelorsPlus", "medianGrossRent",
];

export function computeGoodsScore(demo: CatchmentDemographics): GoodsScore {
  const factors = {} as Record<FactorKey, FactorScore>;
  let total = 0;

  for (const key of FACTOR_KEYS) {
    const value = demo[key];
    const normalized = normalize(value, REFERENCE_RANGES[key]);
    const weight = WEIGHTS[key];
    const contribution = value == null ? 0 : normalized * weight;
    factors[key] = { value, normalized, weight, contribution };
    total += contribution;
  }

  return {
    total: Math.round(total * 10) / 10,
    factors,
    catchment: { tractCount: demo.tractCount, population: demo.population },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- scoring`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Goods Score scoring module"
```

---

### Task 7: Catchment aggregation (TDD)

**Files:**
- Create: `lib/catchment.ts`, `__tests__/catchment.test.ts`

`tractsWithinRadius` returns centroids within the radius (with each distance). `aggregateCatchment` blends each metric as a weighted average over tracts that have a non-null value, weight = `population × 1/(distanceMiles + 0.5)`.

- [ ] **Step 1: Write the failing test** — `__tests__/catchment.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { tractsWithinRadius, aggregateCatchment } from "@/lib/catchment";
import type { TractCentroid, TractDemographics } from "@/lib/types";

const store = { lat: 32.84, lon: -117.27 }; // La Jolla-ish

describe("tractsWithinRadius", () => {
  const centroids: TractCentroid[] = [
    { geoid: "06073008000", lat: 32.842, lon: -117.272 }, // ~0.2 mi
    { geoid: "06073008100", lat: 32.9, lon: -117.2 }, // ~6 mi
  ];

  it("keeps only tracts inside the radius and tags distance", () => {
    const out = tractsWithinRadius(store, centroids, 3);
    expect(out).toHaveLength(1);
    expect(out[0].centroid.geoid).toBe("06073008000");
    expect(out[0].distanceMiles).toBeGreaterThan(0);
    expect(out[0].distanceMiles).toBeLessThan(1);
  });
});

describe("aggregateCatchment", () => {
  const demoA: TractDemographics = {
    geoid: "A", medianHomeValue: 1_000_000, medianHouseholdIncome: 150_000,
    medianGrossRent: 2500, population: 5000, pctBachelorsPlus: 60,
  };
  const demoB: TractDemographics = {
    geoid: "B", medianHomeValue: 500_000, medianHouseholdIncome: 80_000,
    medianGrossRent: 1500, population: 5000, pctBachelorsPlus: 40,
  };

  it("blends within the value range and reports meta", () => {
    const result = aggregateCatchment([
      { demo: demoA, distanceMiles: 0.5 },
      { demo: demoB, distanceMiles: 0.5 },
    ]);
    expect(result.tractCount).toBe(2);
    expect(result.population).toBe(10_000);
    expect(result.medianHomeValue!).toBeGreaterThan(500_000);
    expect(result.medianHomeValue!).toBeLessThan(1_000_000);
  });

  it("weights closer tracts more heavily", () => {
    const near = aggregateCatchment([
      { demo: demoA, distanceMiles: 0.1 },
      { demo: demoB, distanceMiles: 5 },
    ]);
    expect(near.medianHomeValue!).toBeGreaterThan(750_000); // pulled toward demoA
  });

  it("ignores nulls per-metric", () => {
    const result = aggregateCatchment([
      { demo: { ...demoA, medianGrossRent: null }, distanceMiles: 0.5 },
      { demo: demoB, distanceMiles: 0.5 },
    ]);
    expect(result.medianGrossRent).toBe(1500); // only demoB contributed
  });

  it("returns nulls and zero meta for an empty catchment", () => {
    const result = aggregateCatchment([]);
    expect(result.tractCount).toBe(0);
    expect(result.medianHomeValue).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- catchment`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `lib/catchment.ts`

```ts
import type {
  CatchmentDemographics, LatLng, TractCentroid, TractDemographics,
} from "@/lib/types";
import { haversineMiles } from "@/lib/distance";

export interface TractInRadius {
  centroid: TractCentroid;
  distanceMiles: number;
}

export function tractsWithinRadius(
  store: LatLng, centroids: TractCentroid[], radiusMiles: number,
): TractInRadius[] {
  const out: TractInRadius[] = [];
  for (const centroid of centroids) {
    const distanceMiles = haversineMiles(store, { lat: centroid.lat, lon: centroid.lon });
    if (distanceMiles <= radiusMiles) out.push({ centroid, distanceMiles });
  }
  return out;
}

interface WeightedTract {
  demo: TractDemographics;
  distanceMiles: number;
}

const METRICS = [
  "medianHomeValue", "medianHouseholdIncome", "medianGrossRent", "pctBachelorsPlus",
] as const;

export function aggregateCatchment(tracts: WeightedTract[]): CatchmentDemographics {
  const result: CatchmentDemographics = {
    medianHomeValue: null, medianHouseholdIncome: null, medianGrossRent: null,
    pctBachelorsPlus: null, tractCount: tracts.length, population: 0,
  };
  if (tracts.length === 0) return result;

  for (const t of tracts) result.population += t.demo.population ?? 0;

  for (const metric of METRICS) {
    let weightedSum = 0;
    let weightTotal = 0;
    for (const { demo, distanceMiles } of tracts) {
      const value = demo[metric];
      if (value == null) continue;
      const pop = demo.population ?? 1;
      const weight = pop * (1 / (distanceMiles + 0.5));
      weightedSum += value * weight;
      weightTotal += weight;
    }
    result[metric] = weightTotal > 0 ? weightedSum / weightTotal : null;
  }

  return result;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- catchment`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: catchment selection and weighted aggregation"
```

---

### Task 8: Tract-centroid data + loader

**Files:**
- Create: `scripts/build-centroids.mjs`, `data/tract-centroids/{stateFips}.json` (generated), `lib/gazetteer.ts`, `__tests__/gazetteer.test.ts`

The Census Gazetteer national tract file is tab-separated (latin1) with `GEOID`, `INTPTLAT`, `INTPTLONG`. The build script reads an already-extracted copy and writes one JSON file per state FIPS (`GEOID` chars 0–2). The loader reads + memoizes a state file. (Download + unzip are plain shell steps; the script is pure Node — no shell-out.)

- [ ] **Step 1: Download + unzip the gazetteer (shell)**

```bash
cd ~/Documents/goodwill-locator
curl -L -o /tmp/gaz_tracts.zip \
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_tracts_national.zip"
mkdir -p /tmp/gaz_tracts && unzip -o /tmp/gaz_tracts.zip -d /tmp/gaz_tracts
ls /tmp/gaz_tracts
```
Expected: a `2023_Gaz_tracts_national.txt` file in `/tmp/gaz_tracts`. (If `unzip` is unavailable on macOS, use `ditto -x -k /tmp/gaz_tracts.zip /tmp/gaz_tracts`.)

- [ ] **Step 2: Write the build script** — `scripts/build-centroids.mjs`

```js
// Parses an already-extracted Census Gazetteer national tract file (tab-separated,
// latin1) and splits centroids into per-state JSON files. Run Step 1 first.
// Usage: node scripts/build-centroids.mjs   (override source with GAZ_DIR=/path)
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const SRC_DIR = process.env.GAZ_DIR || "/tmp/gaz_tracts";
const OUT_DIR = "data/tract-centroids";

async function main() {
  const files = await readdir(SRC_DIR);
  const txtName = files.find((f) => f.endsWith(".txt"));
  if (!txtName) {
    throw new Error(`No .txt found in ${SRC_DIR} — download + unzip the gazetteer first (Step 1).`);
  }
  const raw = await readFile(join(SRC_DIR, txtName), "latin1");

  const lines = raw.split(/\r?\n/);
  const header = lines[0].split("\t").map((h) => h.trim());
  const geoidIdx = header.indexOf("GEOID");
  const latIdx = header.indexOf("INTPTLAT");
  const lonIdx = header.indexOf("INTPTLONG");
  if (geoidIdx < 0 || latIdx < 0 || lonIdx < 0) {
    throw new Error(`Unexpected header: ${header.join("|")}`);
  }

  const byState = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    if (cols.length <= lonIdx) continue;
    const geoid = cols[geoidIdx].trim();
    const lat = parseFloat(cols[latIdx]);
    const lon = parseFloat(cols[lonIdx]);
    if (!geoid || Number.isNaN(lat) || Number.isNaN(lon)) continue;
    const state = geoid.slice(0, 2);
    if (!byState.has(state)) byState.set(state, []);
    byState.get(state).push({ geoid, lat, lon });
  }

  await mkdir(OUT_DIR, { recursive: true });
  for (const [state, arr] of byState) {
    await writeFile(join(OUT_DIR, `${state}.json`), JSON.stringify(arr));
  }
  console.log(`Wrote ${byState.size} state files to ${OUT_DIR}`);
}

main();
```

- [ ] **Step 3: Run the build script**

Run: `node scripts/build-centroids.mjs`
Expected: `Wrote 5x state files to data/tract-centroids`; e.g. `data/tract-centroids/06.json` (California) exists and is non-empty.

- [ ] **Step 4: Write the loader test** — `__tests__/gazetteer.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { loadStateCentroids } from "@/lib/gazetteer";

describe("loadStateCentroids", () => {
  it("loads California (06) centroids", () => {
    const centroids = loadStateCentroids("06");
    expect(centroids.length).toBeGreaterThan(1000);
    expect(centroids[0].geoid.startsWith("06")).toBe(true);
    expect(typeof centroids[0].lat).toBe("number");
  });

  it("returns an empty array for an unknown state", () => {
    expect(loadStateCentroids("99")).toEqual([]);
  });
});
```

- [ ] **Step 5: Implement** — `lib/gazetteer.ts`

```ts
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { TractCentroid } from "@/lib/types";

const cache = new Map<string, TractCentroid[]>();
const DATA_DIR = join(process.cwd(), "data", "tract-centroids");

export function loadStateCentroids(stateFips: string): TractCentroid[] {
  if (cache.has(stateFips)) return cache.get(stateFips)!;
  const file = join(DATA_DIR, `${stateFips}.json`);
  const data: TractCentroid[] = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : [];
  cache.set(stateFips, data);
  return data;
}
```

- [ ] **Step 6: Run the test**

Run: `npm test -- gazetteer`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: tract-centroid build script and state loader"
```

> Note: `data/tract-centroids/*.json` is committed (static reference data, a few MB). Confirm it is NOT git-ignored — the server reads it at runtime.

---

### Task 9: Overpass store client (TDD with mocked fetch)

**Files:**
- Create: `lib/overpass.ts`, `__tests__/overpass.test.ts`

- [ ] **Step 1: Write the failing test** — `__tests__/overpass.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { parseOverpass, fetchGoodwillStores } from "@/lib/overpass";

const sample = {
  elements: [
    {
      type: "node", id: 1, lat: 32.84, lon: -117.27,
      tags: { name: "Goodwill - La Jolla", "addr:street": "123 Prospect St", website: "https://x.org", phone: "555", opening_hours: "Mo-Su 09:00-21:00" },
    },
    { type: "way", id: 2, center: { lat: 32.7, lon: -117.1 }, tags: { name: "Goodwill Midway", brand: "Goodwill" } },
    { type: "node", id: 3, lat: 32.6, lon: -117.0, tags: { name: "Some Other Shop" } },
  ],
};

describe("parseOverpass", () => {
  it("maps elements to Store objects with id/name/location", () => {
    const stores = parseOverpass(sample);
    expect(stores).toHaveLength(3);
    const first = stores.find((s) => s.id === "node/1")!;
    expect(first.name).toBe("Goodwill - La Jolla");
    expect(first.location).toEqual({ lat: 32.84, lon: -117.27 });
    expect(first.website).toBe("https://x.org");
  });

  it("reads way center coordinates", () => {
    const stores = parseOverpass(sample);
    const way = stores.find((s) => s.id === "way/2")!;
    expect(way.location).toEqual({ lat: 32.7, lon: -117.1 });
  });
});

describe("fetchGoodwillStores", () => {
  afterEach(() => vi.restoreAllMocks());

  it("POSTs an Overpass query and returns parsed stores", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(sample), { status: 200 }));
    const stores = await fetchGoodwillStores({ lat: 32.84, lon: -117.27 }, 10);
    expect(spy).toHaveBeenCalledOnce();
    expect(stores.length).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- overpass`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `lib/overpass.ts`

```ts
import type { LatLng, Store } from "@/lib/types";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const FALLBACK = "https://overpass.kumi.systems/api/interpreter";

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}
interface OverpassResponse { elements: OverpassElement[] }

function buildQuery(center: LatLng, radiusMiles: number): string {
  const radiusM = Math.round(radiusMiles * 1609.34);
  const { lat, lon } = center;
  return `[out:json][timeout:25];
(
  nwr["shop"="charity"]["name"~"Goodwill",i](around:${radiusM},${lat},${lon});
  nwr["brand"~"Goodwill",i](around:${radiusM},${lat},${lon});
);
out center tags;`;
}

export function parseOverpass(data: OverpassResponse): Store[] {
  const seen = new Set<string>();
  const stores: Store[] = [];
  for (const el of data.elements) {
    const tags = el.tags ?? {};
    const name = tags.name ?? tags.brand ?? "Goodwill";
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const id = `${el.type}/${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const addr = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"], tags["addr:state"]]
      .filter(Boolean)
      .join(" ");
    stores.push({
      id,
      name,
      location: { lat, lon },
      address: addr || undefined,
      openingHours: tags.opening_hours,
      website: tags.website ?? tags["contact:website"],
      phone: tags.phone ?? tags["contact:phone"],
    });
  }
  return stores;
}

export async function fetchGoodwillStores(center: LatLng, radiusMiles: number): Promise<Store[]> {
  const body = `data=${encodeURIComponent(buildQuery(center, radiusMiles))}`;
  const opts: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    next: { revalidate: 86400 }, // cache a day
  };
  let res: Response;
  try {
    res = await fetch(ENDPOINT, opts);
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
  } catch {
    res = await fetch(FALLBACK, opts);
  }
  const data = (await res.json()) as OverpassResponse;
  return parseOverpass(data);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- overpass`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Overpass Goodwill store client"
```

---

### Task 10: Census ACS demographics client (TDD with mocked fetch)

**Files:**
- Create: `lib/census.ts`, `__tests__/census.test.ts`

ACS returns a 2D array (header row + value rows). Two endpoints are joined on `GEOID` (`state+county+tract`): the detail table (income, home value, rent, population) and the subject table (% bachelor's+). Census missing-data sentinels (large negatives like `-666666666`) become `null`.

- [ ] **Step 1: Write the failing test** — `__tests__/census.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { parseAcsDetail, parseAcsSubject, fetchCountyDemographics } from "@/lib/census";

const detail = [
  ["NAME", "B19013_001E", "B25077_001E", "B25064_001E", "B01003_001E", "state", "county", "tract"],
  ["Tract 1", "150000", "1000000", "2500", "5000", "06", "073", "008000"],
  ["Tract 2", "-666666666", "500000", "1500", "4000", "06", "073", "008100"],
];
const subject = [
  ["NAME", "S1501_C02_015E", "state", "county", "tract"],
  ["Tract 1", "60.5", "06", "073", "008000"],
  ["Tract 2", "40.0", "06", "073", "008100"],
];

describe("parseAcsDetail", () => {
  it("maps rows by GEOID and nulls negative sentinels", () => {
    const map = parseAcsDetail(detail);
    expect(map["06073008000"].medianHouseholdIncome).toBe(150000);
    expect(map["06073008100"].medianHouseholdIncome).toBeNull();
    expect(map["06073008000"].population).toBe(5000);
  });
});

describe("parseAcsSubject", () => {
  it("maps percent bachelors by GEOID", () => {
    const map = parseAcsSubject(subject);
    expect(map["06073008000"]).toBeCloseTo(60.5);
  });
});

describe("fetchCountyDemographics", () => {
  afterEach(() => vi.restoreAllMocks());

  it("joins detail + subject into TractDemographics[]", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const u = String(url);
      const payload = u.includes("/subject") ? subject : detail;
      return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
    });
    const tracts = await fetchCountyDemographics("06", "073");
    expect(tracts).toHaveLength(2);
    const t1 = tracts.find((t) => t.geoid === "06073008000")!;
    expect(t1.medianHomeValue).toBe(1000000);
    expect(t1.pctBachelorsPlus).toBeCloseTo(60.5);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- census`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `lib/census.ts`

```ts
import type { TractDemographics } from "@/lib/types";

const BASE = "https://api.census.gov/data/2022/acs/acs5";

// Census uses large negative sentinels for missing/suppressed values.
function num(raw: string | undefined): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n <= -666666666) return null;
  return n;
}

type Row = string[];
type Table = Row[];

function geoid(row: Row, sIdx: number, cIdx: number, tIdx: number): string {
  return `${row[sIdx]}${row[cIdx]}${row[tIdx]}`;
}

export function parseAcsDetail(table: Table): Record<string, Omit<TractDemographics, "pctBachelorsPlus">> {
  const [header, ...rows] = table;
  const inc = header.indexOf("B19013_001E");
  const home = header.indexOf("B25077_001E");
  const rent = header.indexOf("B25064_001E");
  const pop = header.indexOf("B01003_001E");
  const s = header.indexOf("state");
  const c = header.indexOf("county");
  const t = header.indexOf("tract");
  const out: Record<string, Omit<TractDemographics, "pctBachelorsPlus">> = {};
  for (const row of rows) {
    const id = geoid(row, s, c, t);
    out[id] = {
      geoid: id,
      medianHouseholdIncome: num(row[inc]),
      medianHomeValue: num(row[home]),
      medianGrossRent: num(row[rent]),
      population: num(row[pop]),
    };
  }
  return out;
}

export function parseAcsSubject(table: Table): Record<string, number | null> {
  const [header, ...rows] = table;
  const pct = header.indexOf("S1501_C02_015E");
  const s = header.indexOf("state");
  const c = header.indexOf("county");
  const t = header.indexOf("tract");
  const out: Record<string, number | null> = {};
  for (const row of rows) out[geoid(row, s, c, t)] = num(row[pct]);
  return out;
}

export async function fetchCountyDemographics(
  stateFips: string, countyFips: string,
): Promise<TractDemographics[]> {
  const key = process.env.CENSUS_API_KEY ? `&key=${process.env.CENSUS_API_KEY}` : "";
  const where = `&for=tract:*&in=state:${stateFips}%20county:${countyFips}`;
  const detailUrl = `${BASE}?get=NAME,B19013_001E,B25077_001E,B25064_001E,B01003_001E${where}${key}`;
  const subjectUrl = `${BASE}/subject?get=NAME,S1501_C02_015E${where}${key}`;

  const opts: RequestInit = { next: { revalidate: 2592000 } }; // 30 days
  const [detailRes, subjectRes] = await Promise.all([fetch(detailUrl, opts), fetch(subjectUrl, opts)]);
  if (!detailRes.ok) throw new Error(`Census detail ${detailRes.status}`);
  if (!subjectRes.ok) throw new Error(`Census subject ${subjectRes.status}`);

  const detail = parseAcsDetail((await detailRes.json()) as Table);
  const subject = parseAcsSubject((await subjectRes.json()) as Table);

  return Object.values(detail).map((d) => ({ ...d, pctBachelorsPlus: subject[d.geoid] ?? null }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- census`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Census ACS demographics client"
```

---

### Task 11: Geocoding client (TDD with mocked fetch)

**Files:**
- Create: `lib/geocode.ts`, `__tests__/geocode.test.ts`

`geocodeAddress` turns a ZIP/address into `LatLng` via the Census onelineaddress endpoint (Nominatim fallback). `getStateForPoint` returns the 2-digit state FIPS for a coordinate via the Census geographies endpoint (used to pick which centroid file to load).

- [ ] **Step 1: Write the failing test** — `__tests__/geocode.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { geocodeAddress, getStateForPoint } from "@/lib/geocode";

const censusLoc = { result: { addressMatches: [{ coordinates: { x: -117.27, y: 32.84 } }] } };
const censusGeo = { result: { geographies: { "Census Tracts": [{ STATE: "06", COUNTY: "073", TRACT: "008000" }] } } };

describe("geocodeAddress", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns LatLng from the Census locations endpoint", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(censusLoc), { status: 200 }));
    expect(await geocodeAddress("92037")).toEqual({ lat: 32.84, lon: -117.27 });
  });

  it("returns null when there are no matches (and Nominatim also empty)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ result: { addressMatches: [] } }), { status: 200 }),
    );
    // first call returns no census match; the implementation then tries Nominatim,
    // which the same mock answers with the same (non-array) body → null.
    expect(await geocodeAddress("nowhere-xyz")).toBeNull();
  });
});

describe("getStateForPoint", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns the 2-digit state FIPS", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(censusGeo), { status: 200 }));
    expect(await getStateForPoint({ lat: 32.84, lon: -117.27 })).toBe("06");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- geocode`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `lib/geocode.ts`

```ts
import type { LatLng } from "@/lib/types";

const GEOCODER = "https://geocoding.geo.census.gov/geocoder";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

export async function geocodeAddress(query: string): Promise<LatLng | null> {
  const url = `${GEOCODER}/locations/onelineaddress?address=${encodeURIComponent(query)}&benchmark=Public_AR_Current&format=json`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (res.ok) {
      const data = await res.json();
      const m = data?.result?.addressMatches?.[0];
      if (m) return { lat: m.coordinates.y, lon: m.coordinates.x };
    }
  } catch {
    // fall through to Nominatim
  }
  const nUrl = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&countrycodes=us&limit=1`;
  const nRes = await fetch(nUrl, {
    headers: { "User-Agent": "goodwill-locator/1.0" },
    next: { revalidate: 86400 },
  });
  if (!nRes.ok) return null;
  const arr = await nRes.json();
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return { lat: parseFloat(arr[0].lat), lon: parseFloat(arr[0].lon) };
}

export async function getStateForPoint(p: LatLng): Promise<string | null> {
  const url =
    `${GEOCODER}/geographies/coordinates?x=${p.lon}&y=${p.lat}` +
    `&benchmark=Public_AR_Current&vintage=Census2020_Current&format=json`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const data = await res.json();
  const tract = data?.result?.geographies?.["Census Tracts"]?.[0];
  return tract?.STATE ?? null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- geocode`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Census/Nominatim geocoding client"
```

---

### Task 12: `/api/stores` orchestration route

**Files:**
- Create: `app/api/stores/route.ts`
- Create: `.env.local` (add `CENSUS_API_KEY=`; free key at https://api.census.gov/data/key_signup.html)

Pipeline: parse `lat`/`lon`/`radius` → fetch stores → resolve search-area state → load that state's centroids → for each store, select catchment tracts (within `CATCHMENT_RADIUS_MILES`), fetch needed counties' demographics (deduped + cached), aggregate, score, attach distance from the search center → return sorted by score desc.

- [ ] **Step 1: Implement the route** — `app/api/stores/route.ts`

```ts
import { NextResponse } from "next/server";
import type { ScoredStore, TractDemographics } from "@/lib/types";
import { fetchGoodwillStores } from "@/lib/overpass";
import { fetchCountyDemographics } from "@/lib/census";
import { getStateForPoint } from "@/lib/geocode";
import { loadStateCentroids } from "@/lib/gazetteer";
import { tractsWithinRadius, aggregateCatchment } from "@/lib/catchment";
import { computeGoodsScore } from "@/lib/scoring";
import { haversineMiles } from "@/lib/distance";
import { CATCHMENT_RADIUS_MILES } from "@/lib/reference-ranges";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lon = parseFloat(searchParams.get("lon") ?? "");
  const radiusMiles = parseFloat(searchParams.get("radius") ?? "25");
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }

  const center = { lat, lon };

  try {
    const stores = await fetchGoodwillStores(center, radiusMiles);
    if (stores.length === 0) return NextResponse.json({ stores: [] });

    const stateFips = await getStateForPoint(center);
    const centroids = stateFips ? loadStateCentroids(stateFips) : [];

    const perStoreTracts = stores.map((s) =>
      tractsWithinRadius(s.location, centroids, CATCHMENT_RADIUS_MILES),
    );
    const neededCounties = new Set<string>();
    for (const tracts of perStoreTracts) {
      for (const t of tracts) neededCounties.add(t.centroid.geoid.slice(0, 5)); // SSCCC
    }

    const demoByGeoid = new Map<string, TractDemographics>();
    await Promise.all(
      [...neededCounties].map(async (sscc) => {
        const list = await fetchCountyDemographics(sscc.slice(0, 2), sscc.slice(2, 5));
        for (const d of list) demoByGeoid.set(d.geoid, d);
      }),
    );

    const scored: ScoredStore[] = stores.map((store, i) => {
      const weighted = perStoreTracts[i]
        .map((t) => {
          const demo = demoByGeoid.get(t.centroid.geoid);
          return demo ? { demo, distanceMiles: t.distanceMiles } : null;
        })
        .filter((x): x is { demo: TractDemographics; distanceMiles: number } => x !== null);
      const catchment = aggregateCatchment(weighted);
      return {
        ...store,
        distanceMiles: haversineMiles(center, store.location),
        score: computeGoodsScore(catchment),
      };
    });

    scored.sort((a, b) => b.score.total - a.score.total);
    return NextResponse.json({ stores: scored });
  } catch (err) {
    console.error("/api/stores failed", err);
    return NextResponse.json({ error: "Failed to load stores" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Add the Census key env var** — create `.env.local`

```
CENSUS_API_KEY=
```
(Leave blank to start — ACS works keyless at low volume; add a free key before deploy to avoid rate limits. Next's default `.gitignore` ignores `.env*.local`.)

- [ ] **Step 3: Manual verification (live data)**

```bash
npm run dev
# in another shell — La Jolla, San Diego:
curl -s "http://localhost:3000/api/stores?lat=32.84&lon=-117.27&radius=25" | head -c 800
```
Expected: JSON `{ "stores": [ { "name": "...", "distanceMiles": ..., "score": { "total": ..., "factors": {...} } }, ... ] }` sorted by `score.total` descending. First call is slow; repeat is fast (cached).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: /api/stores orchestration route"
```

---

### Task 13: Client data hook

**Files:**
- Create: `lib/use-stores.ts`

- [ ] **Step 1: Implement** — `lib/use-stores.ts`

```ts
"use client";

import { useCallback, useState } from "react";
import type { LatLng, ScoredStore } from "@/lib/types";

interface State {
  stores: ScoredStore[];
  loading: boolean;
  error: string | null;
}

export function useStores() {
  const [state, setState] = useState<State>({ stores: [], loading: false, error: null });

  const search = useCallback(async (center: LatLng, radiusMiles: number) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`/api/stores?lat=${center.lat}&lon=${center.lon}&radius=${radiusMiles}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as { stores: ScoredStore[] };
      setState({ stores: data.stores ?? [], loading: false, error: null });
    } catch (e) {
      setState({ stores: [], loading: false, error: (e as Error).message });
    }
  }, []);

  return { ...state, search };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: useStores client hook"
```

---

### Task 14: Score visual components

**Files:**
- Create: `lib/score-color.ts`, `components/score-ring.tsx`, `components/score-breakdown.tsx`

Shared color helper maps a 0–100 score to a hue (red → amber → green). Used by the ring, the breakdown bars, and (Task 16) the map markers.

- [ ] **Step 1: Implement the color helper** — `lib/score-color.ts`

```ts
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
```

- [ ] **Step 2: Implement the score ring** — `components/score-ring.tsx`

```tsx
import { scoreColor } from "@/lib/score-color";

export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} className="shrink-0" role="img" aria-label={`Goods score ${Math.round(score)}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-foreground text-sm font-semibold">
        {Math.round(score)}
      </text>
    </svg>
  );
}
```

- [ ] **Step 3: Implement the breakdown** — `components/score-breakdown.tsx`

```tsx
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
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: score ring and breakdown components"
```

---

### Task 15: Filters, store card, list, location search, filter panel

**Files:**
- Create: `lib/filters.ts`, `__tests__/filters.test.ts`, `components/store-card.tsx`, `components/store-list.tsx`, `components/location-search.tsx`, `components/filter-panel.tsx`

- [ ] **Step 1: Implement filter logic** — `lib/filters.ts`

```ts
import type { ScoredStore } from "@/lib/types";

export type SortKey = "score" | "distance" | "best-nearby";

export interface Filters {
  radiusMiles: number;
  minScore: number;
  openNowOnly: boolean;
  sort: SortKey;
}

export const DEFAULT_FILTERS: Filters = {
  radiusMiles: 25,
  minScore: 0,
  openNowOnly: false,
  sort: "score",
};

// MVP "open now": OSM opening_hours are too varied to parse reliably, so we do not
// exclude on ambiguous hours. Future: integrate an opening_hours parser.
function looksOpen(_hours?: string): boolean {
  return true;
}

// "Best nearby": score with a mild distance penalty (2 pts per mile).
function bestNearby(s: ScoredStore): number {
  return s.score.total - s.distanceMiles * 2;
}

export function applyFilters(stores: ScoredStore[], f: Filters): ScoredStore[] {
  const filtered = stores.filter(
    (s) =>
      s.distanceMiles <= f.radiusMiles &&
      s.score.total >= f.minScore &&
      (!f.openNowOnly || looksOpen(s.openingHours)),
  );
  const sorted = [...filtered];
  if (f.sort === "score") sorted.sort((a, b) => b.score.total - a.score.total);
  else if (f.sort === "distance") sorted.sort((a, b) => a.distanceMiles - b.distanceMiles);
  else sorted.sort((a, b) => bestNearby(b) - bestNearby(a));
  return sorted;
}
```

- [ ] **Step 2: Write the filters test** — `__tests__/filters.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { applyFilters, DEFAULT_FILTERS } from "@/lib/filters";
import type { ScoredStore } from "@/lib/types";

function store(id: string, total: number, distanceMiles: number): ScoredStore {
  return {
    id, name: id, location: { lat: 0, lon: 0 }, distanceMiles,
    score: { total, factors: {} as ScoredStore["score"]["factors"], catchment: { tractCount: 0, population: 0 } },
  };
}

describe("applyFilters", () => {
  const stores = [store("a", 80, 2), store("b", 40, 1), store("c", 90, 30)];

  it("filters by radius and min score, sorts by score", () => {
    const out = applyFilters(stores, { ...DEFAULT_FILTERS, radiusMiles: 10, minScore: 50 });
    expect(out.map((s) => s.id)).toEqual(["a"]);
  });

  it("sorts by distance", () => {
    const out = applyFilters(stores, { ...DEFAULT_FILTERS, radiusMiles: 50, sort: "distance" });
    expect(out.map((s) => s.id)).toEqual(["b", "a", "c"]);
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npm test -- filters`
Expected: PASS.

- [ ] **Step 4: Implement the store card** — `components/store-card.tsx`

```tsx
"use client";

import type { ScoredStore } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreRing } from "@/components/score-ring";
import { ScoreBreakdown } from "@/components/score-breakdown";

interface Props {
  store: ScoredStore;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function StoreCard({ store, selected, onSelect }: Props) {
  return (
    <Card
      onClick={() => onSelect(store.id)}
      className={`cursor-pointer transition-colors ${selected ? "ring-2 ring-primary" : ""}`}
    >
      <CardContent className="flex gap-3 p-4">
        <ScoreRing score={store.score.total} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-semibold">{store.name}</h3>
            <Badge variant="secondary">{store.distanceMiles.toFixed(1)} mi</Badge>
          </div>
          {store.address && <p className="truncate text-xs text-muted-foreground">{store.address}</p>}
          <div className="mt-3">
            <ScoreBreakdown score={store.score} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Implement the list** — `components/store-list.tsx`

```tsx
"use client";

import type { ScoredStore } from "@/lib/types";
import { StoreCard } from "@/components/store-card";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  stores: ScoredStore[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function StoreList({ stores, loading, error, selectedId, onSelect }: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (error) return <p className="p-4 text-sm text-destructive">{error}</p>;
  if (stores.length === 0)
    return <p className="p-4 text-sm text-muted-foreground">No Goodwill stores found here. Try a wider radius or a different location.</p>;

  return (
    <div className="space-y-3">
      {stores.map((s) => (
        <StoreCard key={s.id} store={s} selected={s.id === selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Implement location search** — `components/location-search.tsx`

```tsx
"use client";

import { useState } from "react";
import type { LatLng } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LocationSearch({ onLocate }: { onLocate: (c: LatLng) => void }) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        onLocate({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => setBusy(false),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    setBusy(false);
    if (!res.ok) return;
    const data = (await res.json()) as { location: LatLng | null };
    if (data.location) onLocate(data.location);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <Button type="button" variant="secondary" onClick={useMyLocation} disabled={busy}>
        📍 Use my location
      </Button>
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ZIP code or address" className="sm:max-w-xs" />
      <Button type="submit" disabled={busy}>Search</Button>
    </form>
  );
}
```

- [ ] **Step 7: Implement the filter panel** — `components/filter-panel.tsx`

```tsx
"use client";

import type { Filters, SortKey } from "@/lib/filters";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  filters: Filters;
  onChange: (next: Filters) => void;
}

export function FilterPanel({ filters, onChange }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  return (
    <div className="space-y-5 rounded-xl border p-4">
      <div className="space-y-2">
        <Label>Radius: {filters.radiusMiles} mi</Label>
        <Slider min={5} max={50} step={5} value={[filters.radiusMiles]} onValueChange={([v]) => set({ radiusMiles: v })} />
      </div>
      <div className="space-y-2">
        <Label>Minimum Goods Score: {filters.minScore}</Label>
        <Slider min={0} max={100} step={5} value={[filters.minScore]} onValueChange={([v]) => set({ minScore: v })} />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="open-now">Open now</Label>
        <Switch id="open-now" checked={filters.openNowOnly} onCheckedChange={(v) => set({ openNowOnly: v })} />
      </div>
      <div className="space-y-2">
        <Label>Sort by</Label>
        <Select value={filters.sort} onValueChange={(v) => set({ sort: v as SortKey })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Goods Score</SelectItem>
            <SelectItem value="distance">Distance</SelectItem>
            <SelectItem value="best-nearby">Best nearby</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: filters, store card, list, location search, filter panel"
```

---

### Task 16: Geocode API wrapper + Leaflet map

**Files:**
- Create: `app/api/geocode/route.ts`, `components/map/store-map.tsx`
- Modify: `app/globals.css` (import Leaflet CSS)
- Install: `leaflet`, `react-leaflet`, `@types/leaflet`

- [ ] **Step 1: Install map deps**

```bash
cd ~/Documents/goodwill-locator
npm install leaflet react-leaflet
npm install -D @types/leaflet
```
(If npm reports a React peer-dependency conflict, install the react-leaflet version matching the installed React major — v5 for React 19, v4 for React 18 — e.g. `npm install react-leaflet@^4 leaflet`.)

- [ ] **Step 2: Geocode route** — `app/api/geocode/route.ts`

```ts
import { NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ location: null }, { status: 400 });
  const location = await geocodeAddress(q);
  return NextResponse.json({ location });
}
```

- [ ] **Step 3: Import Leaflet CSS** — append to `app/globals.css`

```css
@import "leaflet/dist/leaflet.css";
```

- [ ] **Step 4: Map component** — `components/map/store-map.tsx`

```tsx
"use client";

import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { LatLng, ScoredStore } from "@/lib/types";
import { scoreColor } from "@/lib/score-color";

function Recenter({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lon]);
  }, [center, map]);
  return null;
}

interface Props {
  center: LatLng;
  stores: ScoredStore[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function StoreMap({ center, stores, selectedId, onSelect }: Props) {
  return (
    <MapContainer center={[center.lat, center.lon]} zoom={11} className="h-full w-full rounded-xl" scrollWheelZoom>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Recenter center={center} />
      {stores.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.location.lat, s.location.lon]}
          radius={s.id === selectedId ? 12 : 9}
          pathOptions={{
            color: "#fff",
            weight: s.id === selectedId ? 3 : 1,
            fillColor: scoreColor(s.score.total),
            fillOpacity: 0.9,
          }}
          eventHandlers={{ click: () => onSelect(s.id) }}
        >
          <Popup>
            <div className="space-y-1">
              <strong>{s.name}</strong>
              <div>Goods Score: {Math.round(s.score.total)}</div>
              <div>{s.distanceMiles.toFixed(1)} mi away</div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: geocode API route and Leaflet store map"
```

---

### Task 17: Assemble the page (responsive + map/list sync)

**Files:**
- Modify: `app/page.tsx`, `app/layout.tsx`

The page is a client component holding `center`, `filters`, `selectedId`. It runs the search hook when `center`/`radius` change, applies filters client-side, and lays out filters + list + map side by side on desktop, tabs on mobile. The map is dynamically imported with `ssr:false`.

- [ ] **Step 1: Update metadata** — `app/layout.tsx`

Set the exported `metadata`:
```ts
export const metadata = {
  title: "Goodwill Locator — find the best thrift nearby",
  description: "Rank nearby Goodwill stores by neighborhood affluence to find the best finds.",
};
```

- [ ] **Step 2: Implement the page** — `app/page.tsx`

```tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { LatLng } from "@/lib/types";
import { useStores } from "@/lib/use-stores";
import { applyFilters, DEFAULT_FILTERS, type Filters } from "@/lib/filters";
import { LocationSearch } from "@/components/location-search";
import { FilterPanel } from "@/components/filter-panel";
import { StoreList } from "@/components/store-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const StoreMap = dynamic(() => import("@/components/map/store-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-muted" />,
});

const SAN_DIEGO: LatLng = { lat: 32.7157, lon: -117.1611 };

export default function Home() {
  const [center, setCenter] = useState<LatLng>(SAN_DIEGO);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { stores, loading, error, search } = useStores();

  useEffect(() => {
    search(center, filters.radiusMiles);
  }, [center, filters.radiusMiles, search]);

  const visible = useMemo(() => applyFilters(stores, filters), [stores, filters]);

  return (
    <main className="mx-auto flex h-screen max-w-7xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Goodwill Locator</h1>
        <LocationSearch onLocate={setCenter} />
      </header>

      <p className="text-xs text-muted-foreground">
        Goods Score blends nearby census-tract affluence (home value, income, education, rent).
        Store coverage comes from OpenStreetMap and may be incomplete. It estimates donation quality, not inventory.
      </p>

      {/* Desktop: filters + list | map */}
      <div className="hidden min-h-0 flex-1 gap-4 lg:grid lg:grid-cols-[380px_1fr]">
        <div className="flex min-h-0 flex-col gap-4">
          <FilterPanel filters={filters} onChange={setFilters} />
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <StoreList stores={visible} loading={loading} error={error} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        </div>
        <div className="min-h-0">
          <StoreMap center={center} stores={visible} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </div>

      {/* Mobile: tabs */}
      <div className="min-h-0 flex-1 lg:hidden">
        <Tabs defaultValue="list" className="flex h-full flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="filters">Filters</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
          </TabsList>
          <TabsContent value="filters"><FilterPanel filters={filters} onChange={setFilters} /></TabsContent>
          <TabsContent value="list" className="min-h-0 flex-1 overflow-y-auto">
            <StoreList stores={visible} loading={loading} error={error} selectedId={selectedId} onSelect={setSelectedId} />
          </TabsContent>
          <TabsContent value="map" className="min-h-0 flex-1">
            <StoreMap center={center} stores={visible} selectedId={selectedId} onSelect={setSelectedId} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Run the app and verify end-to-end**

```bash
npm run dev
```
Open http://localhost:3000. Expected: San Diego loads by default; list shows scored Goodwills sorted by score; map shows color-graded markers; clicking a card highlights its marker and vice versa; radius/min-score/sort filters change list and map; "Use my location" re-centers. Resize narrow → tabs appear.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: assemble responsive page with synced list and map"
```

---

### Task 18: Polish, README, and deploy

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

````markdown
# Goodwill Locator

Find Goodwill stores near you, ranked by a "Goods Score" — a composite of the surrounding
neighborhood's affluence (the theory: wealthier catchment areas donate better goods).

## Data
- Stores: OpenStreetMap Overpass API
- Demographics: U.S. Census ACS 5-year (income, home value, rent, education)
- Tract centroids: U.S. Census Gazetteer (built via `node scripts/build-centroids.mjs`)
- Map: Leaflet + OpenStreetMap tiles

## Develop
```bash
npm install
# one-time: download + unzip the gazetteer to /tmp/gaz_tracts, then:
node scripts/build-centroids.mjs   # builds data/tract-centroids/*.json
npm run dev
```
Set `CENSUS_API_KEY` in `.env.local` (free: https://api.census.gov/data/key_signup.html).

## Test
```bash
npm test
```

## Limitations
- OSM Goodwill coverage has gaps.
- ACS median home *value* is self-reported, not sale price.
- Catchment-weighted medians are a ranking heuristic.
````

- [ ] **Step 2: Frontend-design polish pass**

Apply the `frontend-design` skill to the components from Tasks 14–17 (spacing, typography, color, empty/loading states, mobile tab ergonomics) without changing data contracts (`ScoredStore`, `Filters`, component props). Re-run `npx tsc --noEmit` and `npm run build` after.

- [ ] **Step 3: Full local verification**

```bash
npm test && npm run build
```
Expected: all tests pass; production build succeeds with no Leaflet SSR errors.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: README; design polish"
```

- [ ] **Step 5: Deploy to Vercel**

```bash
npx vercel link
npx vercel env add CENSUS_API_KEY production   # paste the free key
npx vercel --prod
```
Expected: deploy succeeds; open the production URL, allow geolocation, confirm stores + map + filters work. Confirm `data/tract-centroids/*.json` is included in the deployment (committed, not git-ignored).

- [ ] **Step 6: Final commit (if Vercel added config)**

```bash
git add -A && git commit -m "chore: Vercel project config" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**
- Nearby radius search → Tasks 12, 16 (geolocation + geocode), radius filter Task 15. ✓
- Fixed expert composite + breakdown → Tasks 4, 6, 14. ✓
- Surrounding catchment → Tasks 7, 8, 12. ✓
- Goodwill only → Task 9 (Overpass query name/brand ~ "Goodwill"). ✓
- Robust filtering + sorts → Task 15. ✓
- Map view, synced → Tasks 16, 17. ✓
- Free/open data → Overpass, Census, Gazetteer, OSM tiles (Tasks 8–11). ✓
- shadcn + Tailwind + Next + Vercel → Tasks 1, 2, 18. ✓
- Caching → `next: { revalidate }` (Tasks 9–11); module cache (Task 8). ✓
- Limitations surfaced → Tasks 17, 18. ✓
- Tests for scoring/catchment/distance (+ filters) → Tasks 5, 6, 7, 15. ✓

**Type consistency:** `LatLng`, `Store`, `TractDemographics`, `CatchmentDemographics`, `GoodsScore`, `ScoredStore`, `Filters`, `SortKey` are defined in Tasks 4/15 and used consistently. `computeGoodsScore(demo)` takes one arg everywhere. `loadStateCentroids`, `tractsWithinRadius`, `aggregateCatchment`, `fetchCountyDemographics`, `getStateForPoint`, `geocodeAddress` signatures match their callers in Task 12. The map is the default export consumed by the `dynamic(...)` import in Task 17. `scoreColor` / `FACTOR_LABELS` defined once in Task 14 and reused. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. `looksOpen` MVP behavior is intentional and documented inline. ✓

## Notes for the executor
- Tasks 1–2 use interactive CLIs (`create-next-app`, `shadcn`); the flags given run them non-interactively. If a prompt still appears, accept defaults (TypeScript, App Router, Tailwind, import alias `@/*`).
- Task 8 Step 1 and Tasks 9–12 manual steps need network access. The unit tests (5, 6, 7, 9, 10, 11, 15) are fully offline (mocked `fetch`).
- Keep `data/tract-centroids/*.json` committed — the server reads it at runtime.
- `build-centroids.mjs` is pure Node (no shell-out); download + unzip are separate shell steps.
