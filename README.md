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
