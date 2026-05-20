import { describe, it, expect } from "vitest";
import { loadStateCentroids } from "@/lib/gazetteer";

describe("loadStateCentroids", () => {
  it("loads California (06) centroids", () => {
    const centroids = loadStateCentroids("06");
    expect(centroids.length).toBeGreaterThan(1000);
    expect(centroids[0].geoid.startsWith("06")).toBe(true);
    expect(typeof centroids[0].lat).toBe("number");
  });

  it("returns an empty array for an unknown state", () => {
    expect(loadStateCentroids("99")).toEqual([]);
  });
});
