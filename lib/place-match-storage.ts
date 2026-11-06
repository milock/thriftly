import { createHash } from "node:crypto";
import { findGooglePlaceId } from "@/lib/google-places";
import type { ReportStorage } from "@/lib/listing-reports";
import type { Store } from "@/lib/types";

const PREFIX = "place-matches/v1";
const WINDOW_MS = 5 * 60_000;
const CLIENT_SLOTS = 60;
const MAX_WARM_IDS = 4096;
type MatchStorage = ReportStorage;
type Lookup = typeof findGooglePlaceId;
type MatchResult = { placeId: string | null; status: 200 | 409 | 429 | 502 };
type StoredMatch = { placeId: string | null };

function listingFingerprint(store: Store): string {
  return createHash("sha256").update(JSON.stringify([
    store.id, store.name, store.brandId, store.brand, store.facilityType,
    store.street, store.address, store.locality, store.region, store.location.lat, store.location.lon,
  ])).digest("hex");
}

/** Conditional writes cap shared searches at 60 per client per five minutes. */
async function reserveClientLookup(storage: MatchStorage, reporter: string, fingerprint: string, window: number): Promise<boolean> {
  const firstSlot = parseInt(fingerprint.slice(0, 8), 16) % CLIENT_SLOTS;
  const prefix = `${PREFIX}/rate/${window}/${reporter}/`;
  const occupied = new Set<string>();
  for (let attempt = 0; attempt < CLIENT_SLOTS; attempt++) {
    if (attempt === 4) {
      // Once slots fill, skip known collisions. The list is advisory; only
      // a successful conditional create can reserve a slot.
      let cursor: string | undefined;
      for (let pageIndex = 0; pageIndex < 3; pageIndex++) {
        const page = await storage.page(prefix, cursor);
        for (const path of page.paths) occupied.add(path);
        if (!page.cursor) break;
        cursor = page.cursor;
      }
    }
    const slot = (firstSlot + attempt) % CLIENT_SLOTS;
    const path = `${prefix}${slot}.json`;
    if (occupied.has(path)) continue;
    if (await storage.create(path, { fingerprint })) return true;
    const existing = await storage.read<{ fingerprint: string }>(path);
    if (existing?.fingerprint === fingerprint) return true;
  }
  return false;
}

function matched(record: StoredMatch): MatchResult {
  if (record.placeId !== null && (typeof record.placeId !== "string" || !/^[\w-]{6,512}$/.test(record.placeId))) {
    throw new Error("Invalid place match record");
  }
  return { placeId: record.placeId, status: 200 };
}

export function createPlaceMatcher(storage: MatchStorage, lookup: Lookup = findGooglePlaceId) {
  const warmIds = new Map<string, MatchResult>();
  const inFlight = new Map<string, Promise<MatchResult>>();
  let warmDay: string | undefined;

  function remember(path: string, record: StoredMatch, day: string): MatchResult {
    const result = matched(record);
    if (warmDay === day) {
      if (warmIds.size >= MAX_WARM_IDS) {
        const oldest = warmIds.keys().next().value;
        if (oldest) warmIds.delete(oldest);
      }
      warmIds.set(path, result);
    }
    return result;
  }

  return function match(store: Store, apiKey: string, reporter: string, now = new Date()): Promise<MatchResult> {
    const day = now.toISOString().slice(0, 10);
    if (warmDay !== day) {
      warmIds.clear();
      warmDay = day;
    }
    const fingerprint = listingFingerprint(store);
    const window = Math.floor(now.getTime() / WINDOW_MS);
    const idPath = `${PREFIX}/ids/${day}/${fingerprint}.json`;
    const claimPath = `${PREFIX}/claims/${window}/${fingerprint}.json`;
    const emptyPath = `${PREFIX}/empty/${window}/${fingerprint}.json`;
    const cached = warmIds.get(idPath) ?? warmIds.get(emptyPath);
    if (cached) return Promise.resolve(cached);

    const pending = inFlight.get(idPath);
    if (pending) return pending;

    const run = (async (): Promise<MatchResult> => {
      const stored = await storage.read<StoredMatch>(idPath);
      if (stored) return remember(idPath, stored, day);
      if (await storage.read(emptyPath) !== null) return remember(emptyPath, { placeId: null }, day);

      if (await storage.read<Record<string, never>>(claimPath) === null) {
        if (!await reserveClientLookup(storage, reporter, fingerprint, window)) {
          return { placeId: null, status: 429 };
        }
        // Every instance uses the same immutable claim. Errors and no-match
        // results expire after this window so a transient issue can recover.
        if (await storage.create(claimPath, {})) {
          let placeId: string | null;
          try {
            placeId = await lookup(store, apiKey);
          } catch {
            return { placeId: null, status: 502 };
          }
          const path = placeId ? idPath : emptyPath;
          // A no-match marker represents Thriftly's decision, not Google data.
          if (!await storage.create(path, placeId ? { placeId } : {})) {
            const winner = await storage.read<StoredMatch>(idPath);
            if (winner) return remember(idPath, winner, day);
            throw new Error("Could not save place match");
          }
          return remember(path, { placeId }, day);
        }
      }
      const completed = await storage.read<StoredMatch>(idPath);
      if (completed) return remember(idPath, completed, day);
      if (await storage.read(emptyPath) !== null) return remember(emptyPath, { placeId: null }, day);
      return { placeId: null, status: 409 };
    })().finally(() => inFlight.delete(idPath));

    inFlight.set(idPath, run);
    return run;
  };
}
