import tzLookup from "tz-lookup";
import type { LatLng, Store } from "@/lib/types";

const placeholder = { lat: 38.7946, lon: -106.5348 };
const beeCavesSourceId = "c683e06f-458a-e111-8dde-005056934050";
const beeCavesSourceAddress = "12400 Hwy 71 WBee Caves, Austin, TX, 78736";

export function goodwillCoordinateReviewReason(store: Store): string | undefined {
  const postcode = store.sourceTags?.["addr:postcode"]?.trim() ?? "";
  if (/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(postcode)) return "canadian-postal-code-in-us-feed";
  if (store.location.lat === placeholder.lat && store.location.lon === placeholder.lon) {
    return "shared-source-placeholder-coordinate";
  }
  // The source pin is in Alabama. The operator labels the Texas site a
  // donation center and also lists shopping, so the retail status needs review.
  // https://www.goodwillcentraltexas.org/retail-stores/
  if (store.provenance?.sourceId === beeCavesSourceId && store.address === beeCavesSourceAddress) {
    return "retail-status-conflict-at-source-address";
  }
}

export interface StoreCoordinateCorrection {
  id: string;
  original: LatLng;
  corrected: LatLng;
  originalAddress: string;
  correctedAddress?: string;
  correctedStreet?: string;
  sourceUrl: string;
  verifiedAt: string;
}

/** Apply to the specific upstream record only. A changed input needs review. */
export function applyStoreCoordinateCorrection<T extends Store>(store: T, correction?: StoreCoordinateCorrection): T {
  if (!correction) return store;
  const needsReview = () => { throw new Error("Coordinate correction does not match the source record; review the source and correction before publishing."); };
  if (store.id !== correction.id) return needsReview();
  const originalCoordinates = store.location.lat === correction.original.lat && store.location.lon === correction.original.lon;
  const correctedCoordinates = store.location.lat === correction.corrected.lat && store.location.lon === correction.corrected.lon;
  const originalAddress = store.address === correction.originalAddress;
  const correctedAddress = correction.correctedAddress != null && store.address === correction.correctedAddress;
  if (!(originalCoordinates && originalAddress)) {
    if (correctedCoordinates && (originalAddress || correctedAddress)) return store;
    return needsReview();
  }
  const { lat, lon } = correction.corrected;
  return {
    ...store,
    location: { lat, lon },
    timezone: tzLookup(lat, lon),
    ...(correction.correctedAddress ? { address: correction.correctedAddress } : {}),
    ...(correction.correctedStreet ? { street: correction.correctedStreet } : {}),
    sourceTags: {
      ...store.sourceTags,
      originalLatitude: String(correction.original.lat),
      originalLongitude: String(correction.original.lon),
      ...(correction.correctedAddress ? { originalAddress: correction.originalAddress } : {}),
      coordinateSource: correction.sourceUrl,
      coordinateVerifiedAt: correction.verifiedAt,
    },
  };
}
