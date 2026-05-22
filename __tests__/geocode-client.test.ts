import { describe, it, expect, vi, afterEach } from "vitest";
import { suggestPlaces, geocodeAddress, reverseLabel } from "@/lib/geocode-client";

function photon(features: unknown[]) {
  return new Response(JSON.stringify({ features }), { status: 200 });
}
const feature = (properties: Record<string, unknown>, coords: [number, number]) => ({
  properties,
  geometry: { coordinates: coords },
});

describe("suggestPlaces", () => {
  afterEach(() => vi.restoreAllMocks());

  it("labels a ZIP result with the postcode first, then city/state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      photon([feature({ postcode: "60601", city: "Chicago", state: "Illinois", countrycode: "US" }, [-87.62, 41.88])]),
    );
    const [s] = await suggestPlaces("60601");
    expect(s.label).toBe("60601 · Chicago, IL");
    expect(s).toMatchObject({ lat: 41.88, lon: -87.62 });
  });

  it("labels a street address with the city and state abbreviation", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      photon([
        feature(
          { housenumber: "1600", street: "Pennsylvania Avenue", city: "Washington", state: "District of Columbia", countrycode: "US" },
          [-77.03, 38.89],
        ),
      ]),
    );
    const [s] = await suggestPlaces("1600 pennsylvania");
    expect(s.label).toBe("1600 Pennsylvania Avenue, Washington, DC");
  });

  it("drops non-US results and de-dupes labels", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      photon([
        feature({ name: "Chicago", state: "Illinois", countrycode: "US" }, [-87.62, 41.88]),
        feature({ postcode: "60601", state: "Costa Rica", countrycode: "CR" }, [-84.1, 9.4]),
        feature({ name: "Chicago", state: "Illinois", countrycode: "US" }, [-87.62, 41.88]),
      ]),
    );
    const out = await suggestPlaces("chicago");
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe("Chicago, IL");
  });

  it("returns [] for queries under 3 chars without fetching", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    expect(await suggestPlaces("60")).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("geocodeAddress", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns the first US Photon match", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      photon([feature({ postcode: "98101", city: "Seattle", state: "Washington", countrycode: "US" }, [-122.33, 47.61])]),
    );
    expect(await geocodeAddress("98101")).toEqual({ lat: 47.61, lon: -122.33 });
  });

  it("falls back to Nominatim when Photon yields nothing", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(photon([])) // Photon: no usable feature
      .mockResolvedValueOnce(new Response(JSON.stringify([{ lat: "40.71", lon: "-74.01" }]), { status: 200 }));
    expect(await geocodeAddress("10001")).toEqual({ lat: 40.71, lon: -74.01 });
  });
});

describe("reverseLabel", () => {
  afterEach(() => vi.restoreAllMocks());

  it("builds a 'City, ST' label from Photon reverse", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      photon([feature({ city: "San Diego", state: "California", countrycode: "US" }, [-117.16, 32.71])]),
    );
    expect(await reverseLabel(32.71, -117.16)).toBe("San Diego, CA");
  });
});
