"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import type { Store } from "@/lib/types";

type Listing = Pick<Store, "id" | "name" | "address" | "street" | "locality" | "region" | "location">;
type Disclosure = "closed" | "preview" | "open";
type LoadStatus = "pending" | "loaded" | "unavailable";

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
let placesLibrary: Promise<google.maps.PlacesLibrary> | undefined;
let loaderConfigured = false;
const MAX_CONCURRENT_MATCHES = 3;
const waitingForMatch: Array<() => void> = [];
let activeMatches = 0;

function withPlaceMatchSlot<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    function cancel() {
      const index = waitingForMatch.indexOf(start);
      if (index >= 0) waitingForMatch.splice(index, 1);
      reject(signal.reason);
    }

    function start() {
      signal.removeEventListener("abort", cancel);
      activeMatches++;
      void work().then(resolve, reject).finally(() => {
        activeMatches--;
        waitingForMatch.shift()?.();
      });
    }

    if (signal.aborted) return cancel();
    if (activeMatches < MAX_CONCURRENT_MATCHES) {
      start();
    } else {
      signal.addEventListener("abort", cancel, { once: true });
      waitingForMatch.push(start);
    }
  });
}

function loadPlaces(locale: string) {
  const language = ({ "zh-Hans": "zh-CN", "zh-Hant": "zh-TW", tl: "fil" } as Record<string, string>)[locale] ?? locale;
  return placesLibrary ??= import("@googlemaps/js-api-loader").then(({ setOptions, importLibrary }) => {
    if (!loaderConfigured) {
      setOptions({ key: apiKey, v: "weekly", language, region: "US" });
      loaderConfigured = true;
    }
    return importLibrary("places");
  }).catch(error => {
    placesLibrary = undefined;
    throw error;
  });
}

function googleMapsUrl(store: Listing, placeId: string | null): string {
  const address = store.address || [store.street, store.locality, store.region].filter(Boolean).join(", ");
  const query = [store.name, address || `${store.location.lat},${store.location.lon}`].filter(Boolean).join(" ");
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", query);
  if (placeId) url.searchParams.set("query_place_id", placeId);
  return url.toString();
}

/** Separate from Thriftly's scores. Google renders its rating and attribution. */
export function StoreGoogleDetails({ store }: { store: Listing }) {
  return <GoogleDetails key={store.id} store={store} />;
}

function GoogleDetails({ store }: { store: Listing }) {
  const t = useTranslations("directory");
  const ui = useTranslations("ui");
  const locale = useLocale();
  const panelId = useId();
  const [disclosure, setDisclosure] = useState<Disclosure>("closed");
  const [status, setStatus] = useState<LoadStatus>(apiKey ? "pending" : "unavailable");
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const rating = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const requestDetails = useRef<(() => void) | undefined>(undefined);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const expanded = disclosure !== "closed";

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  useEffect(() => {
    if (!expanded) return;
    function dismiss(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (container.current?.contains(document.activeElement)) trigger.current?.focus();
      clearTimeout(hoverTimer.current);
      setDisclosure("closed");
    }
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [expanded]);

  useEffect(() => {
    const element = host.current;
    const viewportTarget = rating.current;
    if (!apiKey || !element || !viewportTarget) return;

    const controller = new AbortController();
    let queued: AbortController | undefined;
    let started = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let widget: google.maps.places.PlaceDetailsCompactElement | undefined;
    const finish = (outcome: LoadStatus) => {
      if (controller.signal.aborted) return;
      clearTimeout(timeout);
      setStatus(outcome);
      if (outcome === "unavailable") {
        controller.abort();
        widget?.remove();
      }
    };
    const onLoad = () => finish("loaded");
    const onError = () => finish("unavailable");

    async function loadMatch() {
      started = true;
      observer?.disconnect();
      timeout = setTimeout(onError, 12_000);
      const query = new URLSearchParams({ storeId: store.id });
      const requestMatch = () => fetch(`/api/place-match?${query}`, {
        method: "POST", cache: "no-store", signal: controller.signal,
      });
      let response = await requestMatch();
      if (response.status === 409) {
        // Retry the saved result once when another instance owns the claim.
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (controller.signal.aborted) return null;
        response = await requestMatch();
      }
      if (!response.ok) return null;
      const match = await response.json() as { placeId?: unknown };
      return typeof match.placeId === "string" && /^[\w-]{6,512}$/.test(match.placeId) ? match.placeId : null;
    }

    function activate() {
      if (started || queued) return;
      const ticket = new AbortController();
      queued = ticket;
      void attachWidget(ticket);
    }

    async function attachWidget(ticket: AbortController) {
      try {
        const matchId = await withPlaceMatchSlot(ticket.signal, loadMatch);
        if (!matchId) return onError();
        if (controller.signal.aborted) return;
        setPlaceId(matchId);

        const { PlaceDetailsCompactElement } = await loadPlaces(locale);
        if (controller.signal.aborted) return;

        widget = new PlaceDetailsCompactElement({ orientation: "HORIZONTAL" });
        widget.className = "block w-full max-w-[500px] [color-scheme:light] dark:[color-scheme:dark]";
        widget.addEventListener("gmp-load", onLoad, { once: true });
        widget.addEventListener("gmp-error", onError, { once: true });
        const request = document.createElement("gmp-place-details-place-request");
        request.setAttribute("place", matchId);
        widget.append(
          request,
          document.createElement("gmp-place-rating"),
          document.createElement("gmp-place-attribution"),
        );
        element?.append(widget);
      } catch {
        if (!ticket.signal.aborted) onError();
      }
    }

    const observer = typeof IntersectionObserver === "undefined" ? undefined : new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        activate();
      } else if (!started && queued) {
        queued.abort();
        queued = undefined;
      }
    }, { threshold: 0.1 });
    observer?.observe(viewportTarget);
    requestDetails.current = activate;
    if (attempt > 0) activate();

    return () => {
      requestDetails.current = undefined;
      observer?.disconnect();
      queued?.abort();
      controller.abort();
      clearTimeout(timeout);
      widget?.removeEventListener("gmp-load", onLoad);
      widget?.removeEventListener("gmp-error", onError);
      widget?.remove();
    };
  }, [attempt, locale, store.id]);

  function preview() {
    clearTimeout(hoverTimer.current);
    requestDetails.current?.();
    setDisclosure(current => current === "closed" ? "preview" : current);
  }

  return (
    <div
      ref={container}
      onPointerLeave={() => {
        clearTimeout(hoverTimer.current);
        if (!container.current?.contains(document.activeElement)) {
          setDisclosure(current => current === "preview" ? "closed" : current);
        }
      }}
      onBlur={event => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        setDisclosure(current => current === "preview" ? "closed" : current);
      }}
    >
      <div ref={rating} className="text-sm text-muted-foreground">
        <div ref={host} />
        {status !== "loaded" && (
          <div className="flex flex-wrap items-center gap-x-2">
            <p className="py-1" role="status">{t(status === "pending" ? "loadingReviews" : "ratingUnavailable")}</p>
            {apiKey && status === "unavailable" && (
              <button
                type="button"
                className="min-h-8 rounded-sm px-1 text-xs underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => {
                  trigger.current?.focus();
                  setStatus("pending");
                  setAttempt(current => current + 1);
                }}
              >
                {ui("retry")}
              </button>
            )}
          </div>
        )}
      </div>
      <button
        ref={trigger}
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onPointerEnter={event => {
          if (event.pointerType === "mouse" && !expanded) hoverTimer.current = setTimeout(preview, 350);
        }}
        onFocus={event => { if (event.currentTarget.matches(":focus-visible")) preview(); }}
        onClick={() => {
          clearTimeout(hoverTimer.current);
          requestDetails.current?.();
          setDisclosure(current => current === "open" ? "closed" : "open");
        }}
      >
        {t("googleReviews")}
        <ChevronDown className={`size-3.5 ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <div id={panelId} hidden={!expanded} className="space-y-2 pb-2 text-sm text-muted-foreground">
        <p>{t("ratingSeparate")}</p>
        <a
          href={googleMapsUrl(store, placeId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-sm font-medium underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t(placeId ? "readGoogleReviews" : "googleReviews")}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
