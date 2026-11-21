const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
export const hasGoogleMapsApiKey = Boolean(apiKey);

const googleLanguages: Record<string, string> = {
  "zh-Hans": "zh-CN",
  "zh-Hant": "zh-TW",
  tl: "fil",
};

let mapsLibrary: Promise<google.maps.MapsLibrary> | undefined;
let configured = false;

export function loadGoogleMaps(locale: string): Promise<google.maps.MapsLibrary> {
  if (!apiKey) return Promise.reject(new Error("Google Maps browser key is missing"));

  return mapsLibrary ??= import("@googlemaps/js-api-loader").then(({ setOptions, importLibrary }) => {
    if (!configured) {
      setOptions({ key: apiKey, language: googleLanguages[locale] ?? locale, region: "US", v: "weekly" });
      configured = true;
    }
    return importLibrary("maps");
  }).catch(error => {
    mapsLibrary = undefined;
    throw error;
  });
}

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

const authFailureListeners = new Set<() => void>();
let authHookInstalled = false;

export function onGoogleMapsAuthFailure(listener: () => void) {
  authFailureListeners.add(listener);
  if (!authHookInstalled) {
    const original = window.gm_authFailure;
    window.gm_authFailure = () => {
      try {
        original?.();
      } finally {
        authFailureListeners.forEach(notify => notify());
      }
    };
    authHookInstalled = true;
  }
  return () => { authFailureListeners.delete(listener); };
}
