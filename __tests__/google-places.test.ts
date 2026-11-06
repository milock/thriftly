import { afterEach, describe, expect, it, vi } from "vitest";
import type { Store } from "@/lib/types";

const store = {
  id: "goodwill/unit-test",
  name: "Goodwill",
  brandId: "goodwill",
  street: "1400 S Main St Ste 5",
  address: "1400 S Main St Ste 5, Los Angeles, CA 90015",
  locality: "Los Angeles",
  region: "CA",
  location: { lat: 34.035, lon: -118.260 },
  facilityType: "retail",
} satisfies Store;

vi.mock("@/lib/locate", () => ({ allBundledStores: () => [store] }));

import { findGooglePlaceId, selectGooglePlaceId, type GooglePlaceCandidate } from "@/lib/google-places";
import { POST } from "@/app/api/place-match/route";

const match = {
  id: "ChIJSameStore",
  displayName: { text: "Goodwill Southern California Store & Donation Center" },
  location: { latitude: 34.0351, longitude: -118.260 },
  addressComponents: [
    { types: ["street_number"], longText: "1400" },
    { types: ["route"], longText: "South Main Street" },
    { types: ["administrative_area_level_1"], shortText: "CA" },
    { types: ["country"], shortText: "US" },
  ],
  businessStatus: "OPERATIONAL",
} satisfies GooglePlaceCandidate;

afterEach(() => vi.unstubAllEnvs());

describe("Google listing identity", () => {
  it("requires brand, street number, route, region and proximity to agree", () => {
    expect(selectGooglePlaceId(store, [match])).toBe(match.id);
    expect(selectGooglePlaceId(store, [{ ...match, displayName: { text: "Salvation Army Family Store" } }])).toBeNull();
    expect(selectGooglePlaceId(store, [{ ...match, location: { ...match.location, latitude: 34.045 } }])).toBeNull();
    for (const [type, value] of [["street_number", "1408"], ["route", "North Main Street"], ["administrative_area_level_1", "NY"], ["country", "CA"]]) {
      const addressComponents = match.addressComponents.map(component => component.types.includes(type)
        ? { ...component, longText: value, shortText: value } : component);
      expect(selectGooglePlaceId(store, [{ ...match, addressComponents }])).toBeNull();
    }
  });

  it("rejects closed, donation-only, outlet and ambiguous listings for a retail store", () => {
    expect(selectGooglePlaceId(store, [{ ...match, businessStatus: "CLOSED_PERMANENTLY" }])).toBeNull();
    for (const name of ["Goodwill Donation Center", "Goodwill Outlet and Donation Center", "Goodwill Career Center"]) {
      expect(selectGooglePlaceId(store, [{ ...match, displayName: { text: name } }])).toBeNull();
    }
    expect(selectGooglePlaceId(store, [match, { ...match, id: "ChIJAnotherStore" }])).toBeNull();
    expect(selectGooglePlaceId({ ...store, facilityType: "outlet" }, [match])).toBeNull();
    expect(selectGooglePlaceId({ ...store, facilityType: "outlet" }, [{ ...match, displayName: { text: "Goodwill Outlet" } }])).toBe(match.id);
  });

  it("accepts Value Village as the listed Savers brand without mislabeling it Goodwill", () => {
    const savers = { ...store, brandId: "savers", brand: "Value Village", name: "Value Village" };
    expect(selectGooglePlaceId(savers, [{ ...match, displayName: { text: "Value Village" } }])).toBe(match.id);
    expect(selectGooglePlaceId(savers, [match])).toBeNull();
  });

  it("requests one bounded set of identity fields and never fetches ratings", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ places: [match] }));
    await expect(findGooglePlaceId(store, "server-test-key", fetcher)).resolves.toBe(match.id);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(options).toMatchObject({ cache: "no-store", redirect: "error", method: "POST", headers: { "X-Goog-Api-Key": "server-test-key" } });
    const fieldMask = new Headers(options?.headers).get("X-Goog-FieldMask");
    expect(fieldMask).toContain("places.addressComponents");
    expect(fieldMask).not.toMatch(/reviews|rating|\*/i);
    expect(JSON.parse(String(options?.body))).toMatchObject({ textQuery: `Goodwill ${store.address}`, pageSize: 5 });
  });
});

describe("place match route", () => {
  function request(query: string, origin = "https://thriftly.xyz") {
    return new Request(`https://thriftly.xyz/api/place-match?${query}`, { method: "POST", headers: { Origin: origin } });
  }
  it("rejects cross-origin requests and unknown or arbitrary stores before any upstream lookup", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    expect((await POST(request("storeId=goodwill%2Funit-test", "https://elsewhere.test"))).status).toBe(403);
    expect((await POST(request("storeId=not-in-directory"))).status).toBe(404);
    expect((await POST(request("storeId=goodwill%2Funit-test&query=anything"))).status).toBe(400);
    const unconfigured = await POST(request("storeId=goodwill%2Funit-test"));
    expect(unconfigured.status).toBe(503);
    expect(unconfigured.headers.get("cache-control")).toBe("private, no-store");
    expect(await unconfigured.json()).toEqual({ placeId: null });
  });

  it("fails closed when private match storage is unconfigured", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("REPORTS_RATE_LIMIT_SECRET", "s".repeat(48));
    const fetcher = vi.spyOn(globalThis, "fetch");
    try {
      expect((await POST(request("storeId=goodwill%2Funit-test"))).status).toBe(503);
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      fetcher.mockRestore();
    }
  });
});
