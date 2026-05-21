import { describe, it, expect } from "vitest";
import { METROS, getMetro } from "@/lib/metros";

describe("metros", () => {
  it("has a non-trivial number of curated metros", () => {
    expect(METROS.length).toBeGreaterThanOrEqual(20);
  });

  it("uses unique, url-safe slugs", () => {
    const slugs = METROS.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("slug ends with the lowercased state code", () => {
    for (const m of METROS) {
      expect(m.slug.endsWith(`-${m.state.toLowerCase()}`)).toBe(true);
    }
  });

  it("has valid U.S. coordinates and a sane radius", () => {
    for (const m of METROS) {
      expect(m.lat).toBeGreaterThan(24);
      expect(m.lat).toBeLessThan(50);
      expect(m.lon).toBeGreaterThan(-125);
      expect(m.lon).toBeLessThan(-66);
      expect(m.radiusMiles).toBeGreaterThanOrEqual(10);
      expect(m.radiusMiles).toBeLessThanOrEqual(30);
    }
  });

  it("resolves a metro by slug and returns undefined for misses", () => {
    expect(getMetro("san-diego-ca")?.city).toBe("San Diego");
    expect(getMetro("not-a-real-city")).toBeUndefined();
  });
});
