import 'server-only';
import {allBundledStores} from '@/lib/locate';
import {createDetailsRateLimiter, createGoogleDetailsLoader, detailsIdentity, DetailsError} from '@/lib/google-place-details';

// Shared within each warm server instance. Only active requests are deduplicated.
const limit = createDetailsRateLimiter();
const load = createGoogleDetailsLoader();
let places: ReadonlyMap<string, string> | undefined;

export async function loadStoreGoogleDetails(storeId: string, request: Pick<Request, 'headers'>) {
  places ??= new Map(allBundledStores().filter(store => !!store.googlePlaceId).map(store => [store.id, store.googlePlaceId!]));
  const placeId = places.get(storeId);
  if (!placeId) throw new DetailsError(400, 'unknown_store');
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) throw new DetailsError(503, 'details_unavailable');
  limit(detailsIdentity(request));
  return load(placeId, apiKey);
}
