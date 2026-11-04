import { describe, it, expect, vi, afterEach } from "vitest";
import { parseOverpass, fetchGoodwillStores, assertCurrentOverpass } from "@/lib/overpass";

const sample = {
  osm3s: {timestamp_osm_base:new Date().toISOString()},
  elements: [
    {
      type: "node", id: 1, lat: 32.84, lon: -117.27,
      tags: { name: "Goodwill - La Jolla", "addr:street": "123 Prospect St", website: "https://x.org", phone: "555", opening_hours: "Mo-Su 09:00-21:00" },
    },
    { type: "way", id: 2, center: { lat: 32.7, lon: -117.1 }, tags: { name: "Goodwill Midway", brand: "Goodwill" } },
    { type: "node", id: 3, lat: 32.6, lon: -117.0, tags: { name: "Some Other Shop" } },
  ],
};

describe("parseOverpass", () => {
  it("maps elements to Store objects with id/name/location", () => {
    const stores = parseOverpass(sample);
    expect(stores).toHaveLength(3);
    const first = stores.find((s) => s.id === "node/1")!;
    expect(first.name).toBe("Goodwill - La Jolla");
    expect(first.location).toEqual({ lat: 32.84, lon: -117.27 });
    expect(first.website).toBe("https://x.org");
  });

  it("reads way center coordinates", () => {
    const stores = parseOverpass(sample);
    const way = stores.find((s) => s.id === "way/2")!;
    expect(way.location).toEqual({ lat: 32.7, lon: -117.1 });
  });
});

describe("fetchGoodwillStores", () => {
  afterEach(() => vi.restoreAllMocks());

  it("POSTs an Overpass query and returns parsed stores", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(sample), { status: 200 }));
    const stores = await fetchGoodwillStores({ lat: 32.84, lon: -117.27 }, 10);
    // Races the public Overpass mirrors in parallel (Promise.any), so fetch
    // fires once per mirror and the first success wins.
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(stores.length).toBe(3);
  });
});

describe('upstream freshness', () => {
  it('rejects stale, missing, future, and partial source responses', () => {
    const now=Date.now();
    for(const body of [
      {},
      {osm3s:{timestamp_osm_base:'invalid'}},
      {osm3s:{timestamp_osm_base:new Date(now-8*86400000).toISOString()}},
      {osm3s:{timestamp_osm_base:new Date(now+86400000).toISOString()}},
      {osm3s:{timestamp_osm_base:new Date(now).toISOString()},remark:'runtime error: timeout'}
    ]) expect(()=>assertCurrentOverpass(body)).toThrow();
  });
  it('accepts a recent complete source snapshot', () => {
    expect(()=>assertCurrentOverpass(sample)).not.toThrow();
  });
});
