import { describe, it, expect } from "vitest";
import { CITIES, STATES, getCity, getState, citiesInState } from "@/lib/cities";

describe("cities dataset", () => {
  it("covers all 50 states plus DC", () => {
    expect(STATES.length).toBe(51);
  });

  it("has a city in every state", () => {
    for (const s of STATES) {
      expect(citiesInState(s.code).length).toBeGreaterThan(0);
    }
  });

  it("has a substantial number of cities", () => {
    expect(CITIES.length).toBeGreaterThanOrEqual(300);
  });

  it("uses unique, url-safe city slugs ending in the state code", () => {
    const slugs = CITIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const c of CITIES) {
      expect(c.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(c.slug.endsWith(`-${c.state.toLowerCase()}`)).toBe(true);
    }
  });

  it("preserves the original metro slugs", () => {
    for (const slug of ["san-diego-ca", "new-york-ny", "st-louis-mo", "washington-dc"]) {
      expect(getCity(slug)).toBeDefined();
    }
  });

  it("uses unique, url-safe state slugs", () => {
    const slugs = STATES.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of STATES) expect(s.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("resolves states and cities by slug, and misses gracefully", () => {
    expect(getState("california")?.code).toBe("CA");
    expect(getCity("san-diego-ca")?.city).toBe("San Diego");
    expect(getState("not-a-state")).toBeUndefined();
    expect(getCity("not-a-city")).toBeUndefined();
  });
});
