import { NextResponse } from "next/server";
import { locateStores, locateStoresFresh, nearestStore } from "@/lib/locate";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lon = parseFloat(searchParams.get("lon") ?? "");
  let radiusMiles = parseFloat(searchParams.get("radius") ?? "25");
  // `live=1` forces a fresh Overpass lookup (the city-page Refresh button); the
  // default serves the instant bundled dataset.
  const live = searchParams.get("live") === "1";
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: "valid lat and lon are required" }, { status: 400 });
  }
  // Clamp radius to a sane range so a crafted request can't trigger huge upstream queries.
  radiusMiles = Number.isFinite(radiusMiles) ? Math.min(100, Math.max(0.5, radiusMiles)) : 25;

  try {
    const stores = live
      ? await locateStoresFresh({ lat, lon }, radiusMiles)
      : await locateStores({ lat, lon }, radiusMiles);
    // Coverage gap: nothing in range. Hand back the single nearest store so the
    // UI can offer to jump to it instead of showing a dead end.
    if (stores.length === 0) {
      return NextResponse.json({ stores, nearest: nearestStore({ lat, lon }) });
    }
    return NextResponse.json({ stores });
  } catch (err) {
    console.error("/api/stores failed", err);
    return NextResponse.json({ error: "Failed to load stores" }, { status: 502 });
  }
}
