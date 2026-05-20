import { describe, it, expect } from "vitest";
import { haversineMiles } from "@/lib/distance";

describe("haversineMiles", () => {
  it("is ~0 for identical points", () => {
    expect(haversineMiles({ lat: 32.7, lon: -117.1 }, { lat: 32.7, lon: -117.1 })).toBeCloseTo(0, 5);
  });

  it("matches a known distance (San Diego → LA ≈ 110.8 mi)", () => {
    const sd = { lat: 32.7157, lon: -117.1611 };
    const la = { lat: 34.0522, lon: -118.2437 };
    expect(haversineMiles(sd, la)).toBeGreaterThan(108);
    expect(haversineMiles(sd, la)).toBeLessThan(114);
  });
});
