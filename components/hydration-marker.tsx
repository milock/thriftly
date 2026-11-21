"use client";
import {useEffect} from "react";

/**
 * Marks <html data-hydrated> once React has hydrated the page. Browser tests
 * wait for it before interacting, because WebKit can finish loading well
 * before React has attached event handlers. Purely a signal; no visible effect.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return null;
}
