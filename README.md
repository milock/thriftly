<div align="center">

# 🛍️ Thriftly

### Find the Goodwill with the best stuff.

Thrift stores in wealthier neighborhoods get better donations. **Thriftly** ranks every
Goodwill near you `0–100` by the affluence of its surrounding area — so you hunt where the treasure
actually is.

[**▶ Live demo → thriftly.xyz**](https://thriftly.xyz)

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss&logoColor=white)
![Tests](https://img.shields.io/badge/tests-55%20passing-3FB950)
![Deployed on Vercel](https://img.shields.io/badge/Vercel-deployed-000000?logo=vercel&logoColor=white)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy_me_a_coffee-flanmorrison-FFDD00?logo=buymeacoffee&logoColor=000)](https://buymeacoffee.com/flanmorrison)

<img src="docs/preview-landing.png" alt="Thriftly landing page" width="860" />

</div>

---

## The idea

A Goodwill is only as good as what gets dropped off — and donations skew with local wealth. Instead
of guessing, Thriftly quantifies it: for every nearby store it pulls the demographics of the
**census tracts within ~3 miles**, blends them by population and distance, and produces a single,
explainable **Goods Score**.

| Locator — light | Locator — dark |
| :---: | :---: |
| <img src="docs/preview-app-light.png" alt="App in light mode" /> | <img src="docs/preview-app-dark.png" alt="App in dark mode" /> |

## Features

- **🎯 Data-driven ranking** — a transparent 0–100 Goods Score with a per-factor breakdown on every store.
- **🗺️ Live map** — color-graded score pins, your search radius drawn in, fly-to on select, light/dark tiles.
- **🧭 Built for the trip** — one tap to **directions**, **reviews**, **website**, **call**, and parsed **store hours** with an "Open now" indicator.
- **🎛️ Robust filters** — radius from a half-mile to 100, minimum score, open-now, and three sort modes.
- **📍 Knows where you are** — auto-geolocation with a reverse-geocoded area label, or search any ZIP/address.
- **🌗 Dark mode** — system-aware with a manual toggle.
- **♿ Accessible** — keyboard-navigable, ARIA-labeled, contrast-aware pins, and `prefers-reduced-motion` support.

## How the Goods Score works

Each store's catchment (tracts within ~3 mi, weighted by population × inverse distance) is scored on
four signals of local affluence, normalized in OKLCH-clean ranges:

| Factor | Weight | Source |
| --- | :---: | --- |
| Median home value | **40%** | ACS `B25077` |
| Median household income | **35%** | ACS `B19013` |
| % bachelor's degree or higher | **15%** | ACS `S1501` |
| Median gross rent | **10%** | ACS `B25064` |

Distance is kept as a separate axis (shown per store and available as a "Best nearby" sort), so the
headline score reflects donation quality, not just proximity.

## Tech stack

**Next.js 16** (App Router) · **TypeScript** · **Tailwind CSS v4** · **shadcn/ui** (Base UI) ·
**react-leaflet** + CARTO/OpenStreetMap tiles · **Vitest** · **Playwright** · deployed on **Vercel**.

Architecture: a single `/api/stores` route fans out to Overpass (stores), Census ACS (demographics),
and a bundled Census Gazetteer (tract centroids), blends each store's catchment, scores it with a
pure, unit-tested module, and returns a ranked list. All upstream calls are cached via the Next Data
Cache.

## Getting started

```bash
npm install

# One-time: build the tract-centroid dataset.
# Download + unzip the Census Gazetteer national tract file to /tmp/gaz_tracts, then:
node scripts/build-centroids.mjs       # writes data/tract-centroids/*.json

npm run dev                            # http://localhost:3000
```

Add a free [Census API key](https://api.census.gov/data/key_signup.html) to `.env.local`:

```bash
CENSUS_API_KEY=your_key_here
```

## Testing

```bash
npm test          # Vitest — pure logic: scoring, catchment, distance, hours, filters
npm run test:e2e  # Playwright — landing + app, desktop + mobile (mocked API)
npm run build     # production build + type check
```

`node scripts/shoot.mjs <url> <tag>` captures dev screenshots across viewports (`SCHEME=dark` for dark mode).

## Project structure

```
app/
  page.tsx              landing page
  app/page.tsx          the locator tool
  api/{stores,geocode,reverse}/route.ts
lib/
  scoring · catchment · distance · hours · score-color · format   (pure, tested)
  overpass · census · geocode · gazetteer                          (data clients)
components/
  store-card · store-list · score-ring · score-breakdown · store-hours
  filter-panel · location-search · methodology · theme-toggle
  map/store-map.tsx
data/tract-centroids/   bundled Census Gazetteer centroids (per state)
__tests__/ · e2e/       Vitest + Playwright
```

## Data & limitations

- **Stores:** OpenStreetMap (Overpass) — coverage has gaps; untagged stores won't appear.
- **Demographics:** U.S. Census ACS 5-year. Median home *value* is self-reported, not sale price.
- Catchment-weighted medians are a ranking heuristic, and the score estimates **donation quality, not live inventory**.

## Support

If this helped you score a great thrift haul, you can
[**buy me a coffee ☕**](https://buymeacoffee.com/flanmorrison).

## License

MIT — see [LICENSE](LICENSE).
