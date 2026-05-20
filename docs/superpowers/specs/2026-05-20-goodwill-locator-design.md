# Goodwill Locator — Design Spec

## Context

Build a standalone webapp that ranks nearby Goodwill stores by **likelihood of quality finds**, on the
premise that stores in/near wealthier areas receive better donations. The app produces a quantitative,
explainable composite score with a per-factor breakdown, robust filtering, and a map view — using
free/open data sources.

**Intended outcome:** enter/allow a location → see Goodwills within a chosen radius, ranked by a
documented "Goods Score," each with a transparent breakdown, on a synced map + list, with filters.

## Locked decisions

| Decision | Choice |
|---|---|
| Search scope | **Nearby radius search** (geolocate or enter ZIP/address) |
| Scoring model | **Fixed expert composite** (we set + document the weights); filters act on results |
| Neighborhood basis | **Surrounding catchment** (blend census tracts within radius, weighted) |
| Store coverage | **Goodwill only** |
| Stack | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui → Vercel |
| Persistence | No auth, no DB. Favorites in `localStorage`. Caching via Next Data Cache (+ optional Vercel KV) |
| Data strategy | **On-demand + aggressive caching** (best fit for radius search) |

## Data sources (all free / open)

- **Store locations — OpenStreetMap Overpass API** (keyless). Query Goodwill stores around the user:
  ```overpassql
  [out:json][timeout:25];
  (
    nwr["shop"="charity"]["name"~"Goodwill",i](around:RADIUS_M,LAT,LON);
    nwr["brand"~"Goodwill",i](around:RADIUS_M,LAT,LON);
  );
  out center tags;
  ```
  Returns name, lat/lon, `addr:*`, `opening_hours`, `website`, `phone` where tagged. Use
  `overpass-api.de` primary, `overpass.kumi.systems` fallback. Cache by rounded bbox.
- **Geocoding — U.S. Census Geocoder** (keyless, US-only): free-text/ZIP → lat/lon AND returns the
  store/user census **geographies** (state+county+tract FIPS). Nominatim (OSM) as fallback. Browser
  `navigator.geolocation` for "use my location."
- **Demographics — Census ACS 5-year API** (free key, instant). One call returns all tracts in a county:
  - `B19013_001E` — median household income
  - `B25077_001E` — median home value (owner-occupied; documented proxy for "median home price")
  - `B25064_001E` — median gross rent
  - `B01003_001E` — total population (catchment weighting)
  - `S1501_C02_015E` (subject table) — % bachelor's degree or higher
- **Tract centroids — Census Gazetteer tract file** (static, `INTPTLAT`/`INTPTLONG`). Loaded per-state,
  cached. Determines which tracts fall inside the catchment radius and their distance weights.

## Scoring model (fixed, documented)

**Goods Score (0–100)** — catchment-weighted affluence composite:

| Factor | Weight | Source | Normalization |
|---|---|---|---|
| Median home value | 40% | B25077 | log-scaled vs national range (skewed) |
| Median household income | 35% | B19013 | linear-clamped vs national range |
| % bachelor's or higher | 15% | S1501 | linear 0–~70% |
| Median gross rent | 10% | B25064 | linear-clamped vs national range |

- Reference ranges live in `lib/reference-ranges.ts` (single source of truth, easy to tune).
- **Catchment weighting:** for tracts whose centroid is within the search radius of the store, weight each
  tract's factor values by `population × inverse-distance`, then composite. (Weighting medians is a
  documented heuristic, not a statistically pure operation — acceptable for a ranking signal.)
- **Distance** is a separate axis: shown on every card, filterable, and the basis for a blended
  **"Best nearby"** sort (`GoodsScore` with a mild distance penalty). Default sort is pure Goods Score.
- **Breakdown panel** exposes: each factor's raw catchment value, its 0–100 normalized score, its weighted
  contribution, plus context stats (population in catchment, # tracts blended, store's own tract value).

## Architecture — on-demand + cache

```
Browser ──(lat,lon,radius,filters)──▶ /api/stores (Route Handler, server-only secrets)
                                          │
        ┌──────────────┬─────────────────┼───────────────────┬──────────────┐
        ▼              ▼                 ▼                   ▼              ▼
   lib/overpass    lib/geocode      lib/census         lib/gazetteer    lib/scoring
   (stores)        (tract FIPS)     (county ACS)       (centroids)      (pure, tested)
        │              │                 │                   │              │
        └──────────────┴───────► lib/catchment (radius + weight) ─────────► scored stores ▶ client
```

- **Caching:** Overpass by rounded bbox; ACS by county FIPS; Gazetteer by state — all via Next Data Cache
  (`fetch` `revalidate`) so overlapping searches reuse upstream data and stay within free limits. Optional
  Vercel KV to cache the final scored result by rounded `location+radius` for instant repeat visits.
- **Pure, isolated, testable modules** (each: clear input → output, no hidden state):
  - `lib/scoring.ts` — normalize factors + composite (TDD: edge cases — missing/zero values, clamping).
  - `lib/distance.ts` — Haversine, mile conversions.
  - `lib/catchment.ts` — select tracts in radius, inverse-distance × population weighting.
  - `lib/reference-ranges.ts` — national normalization constants.
  - `lib/overpass.ts`, `lib/census.ts`, `lib/geocode.ts`, `lib/gazetteer.ts` — data clients (mock `fetch` in tests).
- **Client (App Router):**
  - Map via `react-leaflet` + OSM tiles, **dynamically imported with `ssr:false`** (Leaflet is client-only).
  - Split layout: filter/list panel + map; tabs on mobile. List ↔ map selection synced.
  - Markers color-graded by Goods Score (green→amber→red); popup = name, score, mini-breakdown, distance.

## Proposed file structure

```
goodwill-locator/
├── app/
│   ├── layout.tsx · page.tsx · globals.css
│   └── api/stores/route.ts            # orchestration + caching
├── components/
│   ├── store-list.tsx · store-card.tsx · score-ring.tsx · score-breakdown.tsx
│   ├── filter-panel.tsx · location-search.tsx
│   ├── map/store-map.tsx (ssr:false) · map/store-marker.tsx
│   └── ui/*                           # shadcn: card, slider, select, badge, sheet, tabs,
│                                      #         combobox, separator, button, skeleton, tooltip
├── lib/
│   ├── scoring.ts · distance.ts · catchment.ts · reference-ranges.ts
│   ├── overpass.ts · census.ts · geocode.ts · gazetteer.ts · types.ts · utils.ts
├── __tests__/ (scoring, catchment, distance)
└── components.json · next.config.ts · tailwind/postcss · package.json
```

## Robust filtering & sorting

- **Filters:** distance radius (5/10/25/50 mi) · minimum Goods Score · open now (`opening_hours`) ·
  has website/phone · advanced: min median income, min median home value.
- **Sorts:** Goods Score (default) · distance · "Best nearby" (blended).

## UI / layout sketch

```
┌─────────────────────────────────────────────────────────────┐
│  Goodwill Locator        [ 📍 use my location | ZIP / address ]│
├───────────────────────────┬─────────────────────────────────┤
│ Filters                   │                                  │
│ radius ▢▢▢▢▢  minScore ▢▢ │            MAP                   │
│ ☐ open now  sort: [▼]     │   ● ● scored, color-graded       │
│ ───────────────────────── │   markers; click → popup w/      │
│ ┌───────────────────────┐ │   score + mini breakdown         │
│ │ (87) La Jolla Goodwill │ │                                  │
│ │  ◑ Goods 87  · 2.4 mi  │ │                                  │
│ │  home$ ▰▰▰▰ inc ▰▰▰▱   │ │                                  │
│ └───────────────────────┘ │                                  │
│ ┌───────────────────────┐ │                                  │
│ │ (61) Midway Goodwill   │ │                                  │
│ └───────────────────────┘ │                                  │
└───────────────────────────┴─────────────────────────────────┘
```

## Build sequence (TDD-friendly)

1. **Scaffold** — `create-next-app` (TS/Tailwind/App Router), `shadcn init` + add components, Vercel link, test runner (Vitest).
2. **Pure core (tests first)** — `reference-ranges`, `distance`, `scoring`, `catchment`.
3. **Data clients (mocked fetch tests)** — `geocode`, `overpass`, `census`, `gazetteer`.
4. **Orchestration** — `/api/stores/route.ts` + caching; wire clients → catchment → scoring.
5. **List UI** — filter state, `store-list`, `store-card`, `score-ring`, `score-breakdown`.
6. **Map** — `store-map` (ssr:false) + markers + popup + list↔map sync.
7. **Polish** — frontend-design pass, loading/empty/error states, mobile tabs, favorites (localStorage).
8. **Deploy + verify** — Vercel preview, env (`CENSUS_API_KEY`), end-to-end check.

## Reuse (don't reinvent)

- `~/Documents/sd-neighborhood-mira` — established shadcn setup (`components.json`, `lib/utils.ts`),
  Next.js App Router conventions, and shadcn UI component set to copy patterns from.
- shadcn registry components instead of hand-rolled UI (card, slider, sheet, tabs, badge, skeleton…).

## Verification

- **Unit:** `scoring` (normalization, composite, missing/zero data), `catchment` (distance weighting), `distance` (Haversine).
- **Sanity ranking:** a wealthy-area store (e.g. La Jolla 92037) outranks a low-income-area store in the same metro.
- **Manual local:** `pnpm dev` → allow geolocation in San Diego → map renders, stores scored, breakdown matches, filters + sorts behave, mobile tabs work.
- **Deploy:** Vercel preview loads, `/api/stores` returns scored results, no client Leaflet SSR errors.

## Documented limitations (surface in UI/README)

- OSM Goodwill coverage has gaps (untagged stores won't appear). Note as a known limitation.
- ACS `B25077` is self-reported median home *value*, not sale price — optional **stretch**: enrich with
  Zillow ZHVI ZIP-level CSV for closer home-price fidelity.
- Catchment-weighted medians are a ranking heuristic, not a precise statistic.

## Risks & mitigations

- **Overpass rate limits / downtime** → cache by bbox, fallback instance, graceful error state.
- **Census rate limits** → free API key, cache by county, batch tract fetches in one call.
- **Leaflet SSR crash** → dynamic import `ssr:false`, render map only after mount.
- **Cold-search latency** → loading skeletons, cache warming, KV result cache (optional).

## Out of scope (YAGNI for v1)

Auth, user accounts, server DB, non-Goodwill chains, nationwide precompute, user-adjustable score weights,
real-time inventory.
