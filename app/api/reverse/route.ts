import { NextResponse } from "next/server";
import { reverseGeocode } from "@/lib/geocode";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lon = parseFloat(searchParams.get("lon") ?? "");
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json({ label: null }, { status: 400 });
  }
  const label = await reverseGeocode(lat, lon);
  return NextResponse.json({ label });
}
