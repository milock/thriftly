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
  let radiusMiles = parseFloat(searchParams.get("radius") ?? "25");
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: "valid lat and lon are required" }, { status: 400 });
  }
  // Clamp radius to a sane range so a crafted request can't trigger huge upstream queries.
  radiusMiles = Number.isFinite(radiusMiles) ? Math.min(100, Math.max(0.5, radiusMiles)) : 25;

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
    await Promise.allSettled(
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
