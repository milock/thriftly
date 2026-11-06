import { describe, expect, it, vi } from "vitest";
import { createPlaceMatcher } from "@/lib/place-match-storage";
import type { Store } from "@/lib/types";

const shop: Store = {
  id: "goodwill/first",
  name: "Goodwill",
  brandId: "goodwill",
  facilityType: "retail",
  address: "1400 Main St, Los Angeles, CA",
  region: "CA",
  location: { lat: 34.035, lon: -118.260 },
};
const now = new Date("2026-11-05T20:23:00Z");
const validPlaceId = "ChIJMatchingPlace";
const client = "a".repeat(64);
function fixture() {
  const data = new Map<string, unknown>();
  return {
    data,
    storage: {
      async read<T>(path: string) { return (data.get(path) ?? null) as T | null; },
      async create(path: string, body: unknown) {
        if (data.has(path)) return false;
        data.set(path, body);
        return true;
      },
      async page(prefix: string, cursor?: string) {
        const all = [...data.keys()].filter(path => path.startsWith(prefix)).sort();
        const offset = Number(cursor ?? 0);
        return { paths: all.slice(offset, offset + 25), cursor: all.length > offset + 25 ? String(offset + 25) : null };
      },
    },
  };
}

describe("shared Google listing lookup limits", () => {
  it("allows one upstream lookup across instances for the same store and caches only its ID", async () => {
    const { data, storage } = fixture();
    let release!: () => void;
    let started!: () => void;
    const upstreamStarted = new Promise<void>(resolve => { started = resolve; });
    const waitForRelease = new Promise<void>(resolve => { release = resolve; });
    const lookup = vi.fn(async () => {
      started();
      await waitForRelease;
      return validPlaceId;
    });
    const first = createPlaceMatcher(storage, lookup);
    const second = createPlaceMatcher(storage, lookup);
    const one = first(shop, "test-key", client, now);
    await upstreamStarted;

    await expect(second(shop, "test-key", "b".repeat(64), now)).resolves.toMatchObject({ status: 409 });
    release();
    await expect(one).resolves.toEqual({ placeId: validPlaceId, status: 200 });
    await expect(second(shop, "test-key", client, now)).resolves.toEqual({ placeId: validPlaceId, status: 200 });
    expect(lookup).toHaveBeenCalledOnce();

    const resultBlobs = [...data.entries()].filter(([path]) => path.includes("/ids/"));
    expect(resultBlobs).toHaveLength(1);
    expect(resultBlobs[0][1]).toEqual({ placeId: validPlaceId });
    expect([...data.keys()].every(path => path.startsWith("place-matches/v1/"))).toBe(true);
  });

  it("shares a per-client quota across instances and restores capacity in the next window", async () => {
    const { storage } = fixture();
    const lookup = vi.fn(async () => null);
    const lookups = [createPlaceMatcher(storage, lookup), createPlaceMatcher(storage, lookup)];
    const responses = await Promise.all(Array.from({ length: 64 }, (_, index) =>
      lookups[index % 2]({ ...shop, id: `goodwill/${index}` }, "test-key", client, now)));
    expect(responses.filter(result => result.status === 200)).toHaveLength(60);
    expect(responses.filter(result => result.status === 429)).toHaveLength(4);
    expect(lookup).toHaveBeenCalledTimes(60);

    const later = new Date("2026-11-05T20:25:00Z");
    await expect(lookups[0]({ ...shop, id: "goodwill/next" }, "test-key", client, later)).resolves.toEqual({ placeId: null, status: 200 });
  });

  it("does not open a lookup if shared storage is unavailable", async () => {
    const { storage } = fixture();
    const lookup = vi.fn(async () => validPlaceId);
    const resolve = createPlaceMatcher({ ...storage, create: async () => { throw new Error("unavailable"); } }, lookup);
    await expect(resolve(shop, "test-key", client, now)).rejects.toThrow("unavailable");
    expect(lookup).not.toHaveBeenCalled();
  });

  it("records no matches and bounds failed upstream attempts for the current window", async () => {
    const { storage } = fixture();
    const unmatched = vi.fn(async () => null);
    const failed = vi.fn(async () => { throw new Error("upstream unavailable"); });
    const first = createPlaceMatcher(storage, unmatched);
    const second = createPlaceMatcher(storage, failed);
    await expect(first(shop, "test-key", client, now)).resolves.toEqual({ placeId: null, status: 200 });
    await expect(second(shop, "test-key", client, now)).resolves.toEqual({ placeId: null, status: 200 });
    expect(failed).not.toHaveBeenCalled();

    const other = { ...shop, id: "goodwill/other" };
    await expect(second(other, "test-key", client, now)).resolves.toMatchObject({ status: 502 });
    await expect(first(other, "test-key", client, now)).resolves.toMatchObject({ status: 409 });
    expect(failed).toHaveBeenCalledOnce();
    expect(unmatched).toHaveBeenCalledOnce();

    const later = new Date("2026-11-05T20:25:00Z");
    const recovered = vi.fn(async () => validPlaceId);
    const third = createPlaceMatcher(storage, recovered);
    await expect(third(shop, "test-key", client, later)).resolves.toEqual({ placeId: validPlaceId, status: 200 });
    await expect(third(other, "test-key", client, later)).resolves.toEqual({ placeId: validPlaceId, status: 200 });
    expect(recovered).toHaveBeenCalledTimes(2);
  });

  it("rematches when the official address changes or the daily cache rolls over", async () => {
    const { storage } = fixture();
    const lookup = vi.fn(async () => validPlaceId);
    const resolve = createPlaceMatcher(storage, lookup);
    await resolve(shop, "test-key", client, now);
    await resolve({ ...shop, address: "1402 Main St, Los Angeles, CA" }, "test-key", client, now);
    await resolve(shop, "test-key", client, new Date("2026-11-06T01:00:00Z"));
    expect(lookup).toHaveBeenCalledTimes(3);
  });
});
