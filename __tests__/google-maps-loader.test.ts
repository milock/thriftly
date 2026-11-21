import { afterEach, describe, expect, it, vi } from "vitest";

const { setOptions, importLibrary } = vi.hoisted(() => ({
  setOptions: vi.fn(),
  importLibrary: vi.fn(),
}));

vi.mock("@googlemaps/js-api-loader", () => ({ setOptions, importLibrary }));

async function loadModule(key: string | undefined = "browser-key") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", key);
  return import("@/lib/google-maps-loader");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("Google Maps browser loader", () => {
  it("configures one localized bootstrap and shares concurrent map imports", async () => {
    const library = { Map: vi.fn() };
    importLibrary.mockResolvedValue(library);
    const { loadGoogleMaps } = await loadModule();

    await expect(Promise.all([loadGoogleMaps("zh-Hans"), loadGoogleMaps("zh-Hant")]))
      .resolves.toEqual([library, library]);
    expect(setOptions).toHaveBeenCalledExactlyOnceWith({
      key: "browser-key", language: "zh-CN", region: "US", v: "weekly",
    });
    expect(importLibrary).toHaveBeenCalledExactlyOnceWith("maps");
  });

  it("can retry a failed map import without changing loader options", async () => {
    const library = { Map: vi.fn() };
    importLibrary.mockRejectedValueOnce(new Error("network unavailable")).mockResolvedValue(library);
    const { loadGoogleMaps } = await loadModule();

    await expect(loadGoogleMaps("en")).rejects.toThrow("network unavailable");
    await expect(loadGoogleMaps("en")).resolves.toBe(library);
    expect(setOptions).toHaveBeenCalledTimes(1);
    expect(importLibrary).toHaveBeenCalledTimes(2);
  });

  it("skips Google entirely when the key is missing", async () => {
    const { hasGoogleMapsApiKey, loadGoogleMaps } = await loadModule("  ");

    expect(hasGoogleMapsApiKey).toBe(false);
    await expect(loadGoogleMaps("en")).rejects.toThrow();
    expect(setOptions).not.toHaveBeenCalled();
    expect(importLibrary).not.toHaveBeenCalled();
  });

  it("notifies mounted maps of authentication failures and preserves the existing callback", async () => {
    const original = vi.fn();
    const browser = { gm_authFailure: original };
    vi.stubGlobal("window", browser);
    const { onGoogleMapsAuthFailure } = await loadModule();
    const callback = vi.fn();
    const unsubscribe = onGoogleMapsAuthFailure(callback);

    browser.gm_authFailure();
    unsubscribe();
    browser.gm_authFailure();

    expect(original).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
