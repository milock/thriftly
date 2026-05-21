import { NextResponse } from "next/server";
import { reverseGeocode } from "@/lib/geocode";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lon = parseFloat(searchParams.get("lon") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ label: null }, { status: 400 });
  }
  const label = await reverseGeocode(lat, lon);
  return NextResponse.json({ label });
}
