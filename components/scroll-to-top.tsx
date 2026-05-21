"use client";

import { useEffect } from "react";

/** Resets scroll to the top on mount, so navigating into a page starts at the top. */
export function ScrollToTop() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return null;
}
