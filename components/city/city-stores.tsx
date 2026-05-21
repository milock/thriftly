"use client";

import { useEffect, useState } from "react";
import type { ScoredStore } from "@/lib/types";
import { RankedStores } from "./ranked-stores";

type Enrichment = Pick<ScoredStore, "neighborhood" | "street" | "locality" | "region">;

/**
 * Renders the ranked list immediately (server-provided), then fills in
 * neighborhoods + addresses client-side via /api/enrich so the page paints fast
 * instead of blocking on reverse-geocoding. If the initial stores are already
 * enriched (e.g. precomputed), the merge is a harmless no-op.
 */
export function CityStores({
  initial,
  cityName,
}: {
  initial: ScoredStore[];
  cityName: string;
}) {
  const [stores, setStores] = useState(initial);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const points = initial.map((s) => ({ lat: s.location.lat, lon: s.location.lon }));
        const res = await fetch("/api/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points }),
        });
        const enriched: Record<string, Enrichment> = res.ok ? (await res.json()).enriched : {};
        if (!active) return;
        setStores((cur) =>
          cur.map((st) => {
            const e = enriched[`${st.location.lat},${st.location.lon}`];
            if (!e) return { ...st, enriched: true };
            const street = st.street ?? e.street;
            const locality = st.locality ?? e.locality;
            const region = st.region ?? e.region;
            return {
              ...st,
              enriched: true,
              neighborhood: st.neighborhood ?? e.neighborhood,
              street,
              locality,
              region,
              address: [street, locality, region].filter(Boolean).join(", ") || st.address,
            };
          }),
        );
      } catch {
        if (active) setStores((cur) => cur.map((st) => ({ ...st, enriched: true })));
      }
    })();
    return () => {
      active = false;
    };
  }, [initial]);

  return <RankedStores stores={stores} cityName={cityName} />;
}
