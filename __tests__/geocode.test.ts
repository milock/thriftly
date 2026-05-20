import { describe, it, expect, vi, afterEach } from "vitest";
import { geocodeAddress, getStateForPoint } from "@/lib/geocode";

const censusLoc = { result: { addressMatches: [{ coordinates: { x: -117.27, y: 32.84 } }] } };
const censusGeo = { result: { geographies: { "Census Tracts": [{ STATE: "06", COUNTY: "073", TRACT: "008000" }] } } };

describe("geocodeAddress", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns LatLng from the Census locations endpoint", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(censusLoc), { status: 200 }));
    expect(await geocodeAddress("92037")).toEqual({ lat: 32.84, lon: -117.27 });
  });

  it("returns null when there are no matches (and Nominatim also empty)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ result: { addressMatches: [] } }), { status: 200 }),
    );
    // first call returns no census match; the implementation then tries Nominatim,
    // which the same mock answers with the same (non-array) body → null.
    expect(await geocodeAddress("nowhere-xyz")).toBeNull();
  });
});

describe("getStateForPoint", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns the 2-digit state FIPS", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(censusGeo), { status: 200 }));
    expect(await getStateForPoint({ lat: 32.84, lon: -117.27 })).toBe("06");
  });
});
