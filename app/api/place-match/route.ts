import { blobReportStorage, reporterKey } from "@/lib/listing-reports";
import { allBundledStores } from "@/lib/locate";
import { createPlaceMatcher } from "@/lib/place-match-storage";
import type { Store } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

let stores: Map<string, Store> | undefined;
let match: ReturnType<typeof createPlaceMatcher> | undefined;

function result(placeId: string | null, status = 200) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  if (status === 409) headers.set("Retry-After", "2");
  if (status === 429) headers.set("Retry-After", "300");
  return Response.json({ placeId }, { status, headers });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const expected = `${url.protocol}//${request.headers.get("host") ?? url.host}`;
  if (request.headers.get("origin") !== expected || request.headers.get("sec-fetch-site") === "cross-site") return result(null, 403);
  const storeId = url.searchParams.get("storeId");
  if (url.searchParams.size !== 1 || !storeId || !/^[a-z0-9_/-]{1,128}$/i.test(storeId)) return result(null, 400);

  stores ??= new Map(allBundledStores().map(store => [store.id, store]));
  const store = stores.get(storeId);
  if (!store) return result(null, 404);
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) return result(null, 503);

  try {
    const now = new Date();
    const reporter = reporterKey(request, now);
    match ??= createPlaceMatcher(blobReportStorage());
    const outcome = await match(store, apiKey, reporter, now);
    return result(outcome.placeId, outcome.status);
  } catch {
    return result(null, 503);
  }
}
