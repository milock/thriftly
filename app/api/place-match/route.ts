import { allBundledStores } from '@/lib/locate';

export const runtime = 'nodejs';

function result(placeId: string | null, status = 200) {
  return Response.json({placeId}, {status, headers: {'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'}});
}

/** Compatibility for cached clients. Matching is now an offline curation job. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const expected = `${url.protocol}//${request.headers.get('host') ?? url.host}`;
  if (request.headers.get('origin') !== expected || request.headers.get('sec-fetch-site') === 'cross-site') return result(null, 403);
  const storeId = url.searchParams.get('storeId');
  if (url.searchParams.size !== 1 || !storeId || !/^[a-z0-9_/-]{1,200}$/i.test(storeId)) return result(null, 400);
  const store = allBundledStores().find(store => store.id === storeId);
  return store?.googlePlaceId ? result(store.googlePlaceId) : result(null, 404);
}
