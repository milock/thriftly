import type { Page } from "@playwright/test";

/** Exercise the browser search path with mocked API responses. Coordinate
 * links on an ordinary navigation are rendered with the real server dataset. */
export async function gotoClientSearch(page: Page, path: string) {
  const { pathname, search, hash } = new URL(path, "https://fixture.invalid");
  await page.addInitScript(({ pathname, search, hash }) => {
    if (location.pathname === pathname && !location.search) {
      history.replaceState(null, "", pathname + search + hash);
    }
  }, { pathname, search, hash });
  return page.goto(pathname);
}

// Deterministic API fixtures so e2e tests never depend on live Overpass/Census.
function factor(value: number, normalized: number, weight: number) {
  return { value, normalized, weight, contribution: Math.round(normalized * weight * 10) / 10 };
}

function makeStore(
  id: string,
  locality: string,
  street: string,
  total: number,
  distanceMiles: number,
  lat: number,
  lon: number,
) {
  return {
    id,
    name: "Goodwill",
    googlePlaceId: `ChIJ_thriftly_fixture_${id.replace("node/", "")}`,
    locality,
    street,
    region: "CA",
    address: `${street}, ${locality}, CA`,
    location: { lat, lon },
    openingHours: "Mo-Sa 10:00-20:00; Su 10:00-18:00",
    website: "https://sdgoodwill.org",
    phone: "+1-858-555-0100",
    distanceMiles,
    score: {
      total,
      factors: {
        medianHomeValue: factor(1200000, total, 0.4),
        medianHouseholdIncome: factor(150000, total, 0.35),
        pctBachelorsPlus: factor(60, total, 0.15),
        medianGrossRent: factor(2500, total, 0.1),
      },
      catchment: { tractCount: 12, population: 40000 },
    },
  };
}

export const storesResponse = {
  stores: [
    makeStore("node/1", "La Jolla", "7631 Girard Avenue", 89, 0.3, 32.845, -117.274),
    makeStore("node/2", "Pacific Beach", "1234 Garnet Avenue", 72, 3.1, 32.8, -117.24),
    makeStore("node/3", "Clairemont", "5500 Clairemont Mesa Blvd", 58, 5.4, 32.82, -117.18),
  ],
};

// Photon reverse-geocode shape — yields the "near San Diego, CA" label.
export const photonReverseResponse = {
  features: [{ properties: { city: "San Diego", state: "California", countrycode: "US" } }],
};

export const firstStore = storesResponse.stores[0];

/** The paid details endpoint was removed. Any request to it is a regression. */
export async function blockStoreDetails(page: Page, onRequest?: (url: string) => void) {
  await page.route("**/api/store-details**", route => {
    onRequest?.(route.request().url());
    return route.fulfill({ status: 404, json: { error: "not_found" } });
  });
}
