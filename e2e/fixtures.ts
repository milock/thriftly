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

export const geocodeResponse = { location: { lat: 32.84, lon: -117.27 } };
