import { NextResponse } from "next/server";
import { locateStores, locateStoresFresh, nearestStore, datasetGeneratedAt } from "@/lib/locate";
import { getBrand, parseBrandIds } from "@/lib/brands";

export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat") ?? NaN);
  const lon = Number(searchParams.get("lon") ?? NaN);
  let radiusMiles = parseFloat(searchParams.get("radius") ?? "25");
  // The city refresh button reloads the published operator snapshot; upstream
  // source refreshes run in the scheduled pipeline, never on public requests.
  const live = searchParams.get("live") === "1";
  const rawBrands = searchParams.get("brands");
  if (rawBrands && (rawBrands.length > 240 || rawBrands.split(',').some(id => !getBrand(id)))) {
    return NextResponse.json({error: 'unknown store brand'}, {status: 400});
  }
  const brandIds = parseBrandIds(rawBrands);
  if (!searchParams.get("lat")?.trim() || !searchParams.get("lon")?.trim() || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: "valid lat and lon are required" }, { status: 400 });
  }
  // Clamp radius to a sane range so a crafted request can't trigger huge upstream queries.
  radiusMiles = Number.isFinite(radiusMiles) ? Math.min(100, Math.max(0.5, radiusMiles)) : 25;

  try {
    if (live && radiusMiles > 25) return NextResponse.json({error:'live radius cannot exceed 25 miles'}, {status:400});
    const result = live
      ? await locateStoresFresh({ lat, lon }, radiusMiles, brandIds)
      : {stores: await locateStores({ lat, lon }, radiusMiles, brandIds), generatedAt: datasetGeneratedAt(brandIds)};
    const {stores, generatedAt} = result;
    // Coverage gap: nothing in range. Hand back the single nearest store so the
    // UI can offer to jump to it instead of showing a dead end.
    if (stores.length === 0) {
      return NextResponse.json({ stores, generatedAt, nearest: nearestStore({ lat, lon }, brandIds) });
    }
    return NextResponse.json({ stores, generatedAt });
  } catch (err) {
    console.error("/api/stores failed", err);
    return NextResponse.json({ error: "Failed to load stores" }, { status: 502 });
  }
}
