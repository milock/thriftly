# Goodwill Locator

Find the Goodwill with the best stuff. Thrift stores in wealthier neighborhoods get better
donations, so every nearby Goodwill is ranked by a 0–100 **Goods Score** — a weighted, distance-
blended composite of the surrounding census tracts' affluence.

**Live:** https://goodwill-locator.vercel.app

- `/` — landing page (what it is, how the score works)
- `/app` — the locator: ranked list + map, filters, directions, hours

## How the Goods Score works
For each store we blend the demographics of every census tract within ~3 miles, weighted by
population and distance, then score four signals of local affluence:

| Factor | Weight | Source |
|---|---|---|
| Median home value | 40% | ACS `B25077` |
| Median household income | 35% | ACS `B19013` |
| % bachelor's or higher | 15% | ACS `S1501` |
| Median gross rent | 10% | ACS `B25064` |

## Data
- **Stores:** OpenStreetMap Overpass API
- **Demographics:** U.S. Census ACS 5-year
- **Tract centroids:** U.S. Census Gazetteer (built via `node scripts/build-centroids.mjs`)
- **Map:** Leaflet + CARTO/OpenStreetMap tiles

## Stack
Next.js (App Router) · TypeScript · Tailwind v4 · shadcn/ui · react-leaflet · Vitest · Playwright · Vercel

## Develop
```bash
npm install
# one-time: download + unzip the Census Gazetteer to /tmp/gaz_tracts, then:
node scripts/build-centroids.mjs   # builds data/tract-centroids/*.json
npm run dev
```
Set `CENSUS_API_KEY` in `.env.local` (free, instant: https://api.census.gov/data/key_signup.html).

## Test
```bash
npm test        # Vitest — pure logic (scoring, catchment, distance, hours, filters)
npm run test:e2e   # Playwright — landing + app, desktop + mobile (mocked API)
```

`node scripts/shoot.mjs` captures dev screenshots across viewports for design review.

## Limitations
- OSM Goodwill coverage has gaps (untagged stores won't appear).
- ACS median home *value* is self-reported, not sale price.
- Catchment-weighted medians are a ranking heuristic, and the score estimates donation quality, not live inventory.
