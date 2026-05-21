import { NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ location: null }, { status: 400 });
  const location = await geocodeAddress(q);
  return NextResponse.json({ location });
}
