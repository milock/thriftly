import { describe, it, expect, vi, afterEach } from "vitest";
import { parseAcsDetail, parseAcsSubject, fetchCountyDemographics } from "@/lib/census";

const detail = [
  ["NAME", "B19013_001E", "B25077_001E", "B25064_001E", "B01003_001E", "state", "county", "tract"],
  ["Tract 1", "150000", "1000000", "2500", "5000", "06", "073", "008000"],
  ["Tract 2", "-666666666", "500000", "1500", "4000", "06", "073", "008100"],
];
const subject = [
  ["NAME", "S1501_C02_015E", "state", "county", "tract"],
  ["Tract 1", "60.5", "06", "073", "008000"],
  ["Tract 2", "40.0", "06", "073", "008100"],
];

describe("parseAcsDetail", () => {
  it("maps rows by GEOID and nulls negative sentinels", () => {
    const map = parseAcsDetail(detail);
    expect(map["06073008000"].medianHouseholdIncome).toBe(150000);
    expect(map["06073008100"].medianHouseholdIncome).toBeNull();
    expect(map["06073008000"].population).toBe(5000);
  });
});

describe("parseAcsSubject", () => {
  it("maps percent bachelors by GEOID", () => {
    const map = parseAcsSubject(subject);
    expect(map["06073008000"]).toBeCloseTo(60.5);
  });
});

describe("fetchCountyDemographics", () => {
  afterEach(() => vi.restoreAllMocks());

  it("joins detail + subject into TractDemographics[]", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const u = String(url);
      const payload = u.includes("/subject") ? subject : detail;
      return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
    });
    const tracts = await fetchCountyDemographics("06", "073");
    expect(tracts).toHaveLength(2);
    const t1 = tracts.find((t) => t.geoid === "06073008000")!;
    expect(t1.medianHomeValue).toBe(1000000);
    expect(t1.pctBachelorsPlus).toBeCloseTo(60.5);
  });
});
