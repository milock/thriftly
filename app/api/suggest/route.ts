import { NextResponse } from "next/server";
import { suggestPlaces } from "@/lib/geocode";

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 120);
  const suggestions = await suggestPlaces(q);
  return NextResponse.json({ suggestions });
}
