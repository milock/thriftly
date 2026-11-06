"use client";

import { hasNeighborhoodBaseline } from "@/lib/scoring";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { Minus, Navigation, Plus, Search, X } from "lucide-react";
import { ScoreDetails } from "@/components/score-details";
import { ScoreRing } from "@/components/score-ring";
import { StoreGoogleDetails } from "@/components/store-google-details";
import { haversineMiles } from "@/lib/distance";
import { directionsUrl, formatDistance } from "@/lib/format";
import { hasGoogleMapsApiKey, loadGoogleMaps, onGoogleMapsAuthFailure } from "@/lib/google-maps-loader";
import {storeOpenNow} from "@/lib/store-status";
import { scoreColor, scoreInk } from "@/lib/score-color";
import type { LatLng, ScoredStore } from "@/lib/types";

interface Props {
  center: LatLng;
  radiusMiles: number;
  stores: ScoredStore[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSearchArea: (c: LatLng) => void;
}

type MapStatus = "loading" | "ready" | "unavailable";
type MapRuntime = {
  map: google.maps.Map;
  circle: google.maps.Circle;
  OverlayView: typeof google.maps.OverlayView;
};

const METERS_PER_MILE = 1609.344;
const LOAD_TIMEOUT_MS = 12_000;
const DARK_ROADMAP: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#242428" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#b3b3ba" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1c1c1f" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#53535c" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#3d3d44" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#64646e" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#27332b" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#1b2837" }] },
];

function mapPoint({ lat, lon }: LatLng): google.maps.LatLngLiteral {
  return { lat, lng: lon };
}

function MapOverlay({
  runtime,
  position: { lat, lon },
  pane,
  children,
}: {
  runtime: MapRuntime;
  position: LatLng;
  pane: "markerLayer" | "overlayMouseTarget" | "floatPane";
  children: ReactNode;
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const { map, OverlayView } = runtime;
    const overlay = new OverlayView();
    const node = document.createElement("div");
    node.style.position = "absolute";

    overlay.onAdd = () => {
      overlay.getPanes()?.[pane].appendChild(node);
      if (pane === "overlayMouseTarget") OverlayView.preventMapHitsFrom(node);
      if (pane === "floatPane") OverlayView.preventMapHitsAndGesturesFrom(node);
      setHost(node);
    };
    overlay.draw = () => {
      const projection = overlay.getProjection();
      const point = { lat, lng: lon };
      const pixel = projection.fromLatLngToDivPixel(point);
      if (!pixel) return;
      if (pane !== "floatPane") {
        if (pane === "overlayMouseTarget") {
          node.hidden = map.getBounds()?.contains(point) === false;
        }
        node.style.left = `${pixel.x}px`;
        node.style.top = `${pixel.y}px`;
        return;
      }

      const origin = projection.fromLatLngToContainerPixel(point);
      if (!origin) return;
      const { clientWidth: width, clientHeight: height } = map.getDiv();
      node.hidden = origin.x < 0 || origin.y < 0 || origin.x > width || origin.y > height;
      if (node.hidden) return;
      const margin = 12;
      const popupWidth = Math.max(0, Math.min(272, width - margin * 2));
      const left = Math.max(margin, Math.min(width - margin - popupWidth, origin.x - popupWidth / 2));
      const spaceAbove = origin.y - 26 - margin;
      const spaceBelow = height - origin.y - 26 - 32;
      const above = spaceAbove >= 200 || spaceAbove >= spaceBelow;
      node.style.left = `${pixel.x + left - origin.x}px`;
      node.style.top = `${pixel.y + (above ? -26 : 26)}px`;
      node.style.transform = above ? "translateY(-100%)" : "";
      node.style.width = `${popupWidth}px`;
      node.style.setProperty("--map-popup-height", `${Math.max(56, above ? spaceAbove : spaceBelow)}px`);
    };
    overlay.onRemove = () => node.remove();
    overlay.setMap(map);
    return () => overlay.setMap(null);
  }, [runtime, lat, lon, pane]);

  return host ? createPortal(children, host) : null;
}

function StorePopup({ store, onClose }: { store: ScoredStore; onClose: () => void }) {
  const t = useTranslations("ui");
  const locale = useLocale();
  const labelId = useId();
  const close = useRef<HTMLButtonElement>(null);
  const address = store.google?.address || store.street || store.address;
  const scored = hasNeighborhoodBaseline(store.score);
  const open = storeOpenNow(store);

  useEffect(() => { close.current?.focus({ preventScroll: true }); }, []);

  return (
    <div
      aria-labelledby={labelId}
      className="max-h-[var(--map-popup-height)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-3 text-card-foreground shadow-lg"
      dir={locale === "ar" ? "rtl" : "ltr"}
      onKeyDown={event => {
        if (event.key !== "Escape" || event.defaultPrevented || !event.currentTarget.contains(event.target as Node)) return;
        event.stopPropagation();
        onClose();
      }}
      role="dialog"
      style={{ fontFamily: locale === "ar" ? '"Noto Sans Arabic", var(--font-geist-sans), sans-serif' : "var(--font-geist-sans), sans-serif" }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p id={labelId} className="break-words text-base font-semibold leading-tight">{store.google?.name || store.name}</p>
          {address && (
            <p className="break-words text-sm leading-relaxed text-muted-foreground">
              <bdi dir="auto">{address}</bdi>
            </p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="tabular">{t("away", { distance: formatDistance(store.distanceMiles, locale) })}</span>
            {open !== null && (
              <>
                {" · "}
                <span className={open ? "font-medium text-[var(--brand)]" : undefined}>{open ? t("open") : t("closed")}</span>
              </>
            )}
          </p>
        </div>
        <button
          ref={close}
          aria-label={t("close")}
          className="-me-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <div className="mt-1">
        <StoreGoogleDetails store={store} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {scored ? (
          <ScoreDetails score={store.score}>
            <ScoreRing score={store.score.total} size={44} strokeWidth={4} />
          </ScoreDetails>
        ) : (
          <span className="text-xs text-muted-foreground">{t("notScored")}</span>
        )}
        <a
          href={directionsUrl(store)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-2 text-center text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Navigation aria-hidden className="size-3.5 shrink-0" />
          {t("directions")}
        </a>
      </div>
    </div>
  );
}

export default function StoreMap(props: Props) {
  const [attempt, setAttempt] = useState(0);
  return <GoogleStoreMap key={attempt} {...props} onRetry={() => setAttempt(value => value + 1)} />;
}

function GoogleStoreMap({ center, radiusMiles, stores, selectedId, onSelect, onSearchArea, onRetry }: Props & { onRetry: () => void }) {
  const t = useTranslations("ui");
  const directory = useTranslations("directory");
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const scoreFormatter = new Intl.NumberFormat(locale, { numberingSystem: locale === "ar" ? "arab" : "latn" });
  const canvas = useRef<HTMLDivElement>(null);
  const userPanned = useRef(false);
  const popupTrigger = useRef<HTMLButtonElement>(null);
  const [runtime, setRuntime] = useState<MapRuntime | null>(null);
  const [status, setStatus] = useState<MapStatus>(hasGoogleMapsApiKey ? "loading" : "unavailable");
  const [popupId, setPopupId] = useState<string | null>(null);
  const [lastSelectedId, setLastSelectedId] = useState(selectedId);
  const [movement, setMovement] = useState<{ position: LatLng; center: LatLng; radiusMiles: number; selectedId: string | null } | null>(null);
  if (lastSelectedId !== selectedId) {
    setLastSelectedId(selectedId);
    if (popupId !== selectedId) setPopupId(null);
  }
  const selected = stores.find(store => store.id === selectedId);
  const popup = popupId === selectedId ? selected : undefined;
  const { lat, lon } = center;
  const movedCenter = movement?.center.lat === lat && movement?.center.lon === lon
    && movement.radiusMiles === radiusMiles && movement.selectedId === selectedId ? movement.position : null;

  const initialOptions = useEffectEvent((): google.maps.MapOptions => ({
    center: mapPoint(center),
    zoom: 11,
    renderingType: "RASTER",
    backgroundColor: "transparent",
    disableDefaultUI: true,
    clickableIcons: false,
    gestureHandling: "greedy",
    styles: dark ? DARK_ROADMAP : [],
  }));
  const recordPan = useEffectEvent((map: google.maps.Map) => {
    if (!userPanned.current) return;
    userPanned.current = false;
    const current = map.getCenter();
    if (!current) return;
    const position = { lat: current.lat(), lon: current.lng() };
    const far = haversineMiles(position, center) > Math.max(0.4, radiusMiles * 0.25);
    setMovement(far ? { position, center, radiusMiles, selectedId } : null);
  });

  useEffect(() => {
    const element = canvas.current;
    if (!element || !hasGoogleMapsApiKey) return;

    let active = true;
    let started = false;
    let failed = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let circle: google.maps.Circle | undefined;
    const listeners: google.maps.MapsEventListener[] = [];

    function unavailable() {
      if (!active || failed) return;
      failed = true;
      clearTimeout(watchdog);
      setStatus("unavailable");
    }

    const removeAuthListener = onGoogleMapsAuthFailure(unavailable);
    const observer = new ResizeObserver(startWhenVisible);

    function startWhenVisible() {
      if (started || !element?.clientWidth || !element.clientHeight) return;
      started = true;
      observer.disconnect();
      watchdog = setTimeout(unavailable, LOAD_TIMEOUT_MS);
      void initialize(element);
    }

    async function initialize(element: HTMLDivElement) {
      try {
        const { Map, Circle, OverlayView } = await loadGoogleMaps(locale);
        if (!active || failed) return;
        const map = new Map(element, initialOptions());
        circle = new Circle({ map, clickable: false });
        listeners.push(
          map.addListener("tilesloaded", () => {
            if (!active || failed) return;
            clearTimeout(watchdog);
            setStatus("ready");
          }),
          map.addListener("dragstart", () => { userPanned.current = true; }),
          map.addListener("idle", () => recordPan(map)),
          map.addListener("click", () => setPopupId(null)),
        );
        setRuntime({ map, circle, OverlayView });
      } catch {
        unavailable();
      }
    }

    function keyboardPan(event: KeyboardEvent) {
      if (event.target instanceof Element && event.target.closest("button, [role='dialog']")) return;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) userPanned.current = true;
    }

    observer.observe(element);
    startWhenVisible();
    element.addEventListener("keydown", keyboardPan, true);
    return () => {
      active = false;
      observer.disconnect();
      clearTimeout(watchdog);
      removeAuthListener();
      element.removeEventListener("keydown", keyboardPan, true);
      listeners.forEach(listener => listener.remove());
      circle?.setMap(null);
      element.replaceChildren();
    };
  }, [locale]);

  useEffect(() => {
    if (!runtime) return;
    runtime.map.setOptions({ styles: dark ? DARK_ROADMAP : [] });
    const color = dark ? "#a1a1aa" : "#52525b";
    runtime.circle.setOptions({
      strokeColor: color,
      strokeOpacity: dark ? 0.7 : 0.5,
      strokeWeight: 1.5,
      fillColor: color,
      fillOpacity: 0.07,
    });
  }, [runtime, dark]);

  useEffect(() => {
    if (!runtime) return;
    userPanned.current = false;
    runtime.circle.setOptions({ center: { lat, lng: lon }, radius: radiusMiles * METERS_PER_MILE });
    const bounds = runtime.circle.getBounds();
    if (bounds) runtime.map.fitBounds(bounds, 48);
  }, [runtime, lat, lon, radiusMiles]);

  const selectedLat = selected?.location.lat;
  const selectedLon = selected?.location.lon;
  useEffect(() => {
    if (!runtime || selectedLat === undefined || selectedLon === undefined) return;
    userPanned.current = false;
    runtime.map.moveCamera({
      center: { lat: selectedLat, lng: selectedLon },
      zoom: Math.max(runtime.map.getZoom() ?? 11, 13),
    });
  }, [runtime, selectedId, selectedLat, selectedLon]);

  function closePopup() {
    setPopupId(null);
    if (popupTrigger.current?.isConnected) popupTrigger.current.focus({ preventScroll: true });
  }

  function zoom(delta: number) {
    if (!runtime) return;
    runtime.map.setZoom((runtime.map.getZoom() ?? 11) + delta);
  }

  return (
    <div
      aria-busy={status === "loading"}
      aria-label={t("map")}
      className="relative isolate h-full w-full overflow-hidden bg-muted"
      data-google-map=""
      data-state={status}
      dir="ltr"
      role="region"
    >
      <div
        ref={canvas}
        className={status === "ready" ? "absolute inset-0" : "absolute inset-0 opacity-0"}
        data-google-map-canvas=""
        inert={status !== "ready"}
      />
      {status === "loading" && <div className="absolute inset-0 motion-safe:animate-pulse bg-muted" />}
      {status === "unavailable" && (
        <div className="absolute inset-0 grid place-content-center p-4 text-center" dir={locale === "ar" ? "rtl" : "ltr"}>
          <div className="max-w-sm rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
            <p role="status" className="text-sm">{directory("mapUnavailable")}</p>
            {hasGoogleMapsApiKey && (
              <button
                className="mt-2 min-h-11 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                onClick={onRetry}
                type="button"
              >
                {t("retry")}
              </button>
            )}
          </div>
        </div>
      )}
      {runtime && status === "ready" && (
        <>
          <MapOverlay runtime={runtime} position={center} pane="markerLayer">
            <div aria-hidden className="pointer-events-none absolute grid size-[18px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-blue-500/30">
              <span className="size-2.5 rounded-full border-2 border-white bg-blue-500 shadow-sm" />
            </div>
          </MapOverlay>
          {stores.map(store => {
            const active = store.id === selectedId;
            const scored = hasNeighborhoodBaseline(store.score);
            const score = Math.round(store.score.total);
            const label = [
              store.google?.name || store.name,
              store.google?.address || [store.street, store.neighborhood || store.locality, store.region].filter(Boolean).join(", "),
              scored ? t("scoreAria", { score }) : t("notScored"),
            ].filter(Boolean).join(", ");
            return (
              <MapOverlay key={store.id} runtime={runtime} position={store.location} pane="overlayMouseTarget">
                <button
                  aria-expanded={popupId === store.id && active}
                  aria-haspopup="dialog"
                  aria-label={label}
                  aria-pressed={active}
                  className={`gw-pin absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-transparent p-0 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${active ? "z-10" : ""}`}
                  onClick={event => {
                    userPanned.current = false;
                    setMovement(null);
                    popupTrigger.current = event.currentTarget;
                    setPopupId(store.id);
                    onSelect(store.id);
                  }}
                  type="button"
                >
                  <span
                    aria-hidden
                    className={`grid place-items-center rounded-full border-2 border-white font-bold shadow-md [font-family:var(--font-geist-sans)] ${active ? "size-10 text-sm ring-2 ring-black/60 dark:ring-white/70" : "size-[30px] text-xs"}`}
                    style={{ backgroundColor: scored ? scoreColor(store.score.total) : "#71717a", color: scored ? scoreInk(store.score.total) : "#ffffff" }}
                  >
                    {scored ? scoreFormatter.format(score) : "—"}
                  </span>
                </button>
              </MapOverlay>
            );
          })}
          {popup && (
            <MapOverlay key={popup.id} runtime={runtime} position={popup.location} pane="floatPane">
              <StorePopup store={popup} onClose={closePopup} />
            </MapOverlay>
          )}
          <div className="absolute left-3 top-3 z-10 grid overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-md">
            <button aria-label={t("zoomIn")} className="grid size-11 place-items-center border-b border-border hover:bg-accent focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring" onClick={() => zoom(1)} type="button">
              <Plus aria-hidden className="size-4" />
            </button>
            <button aria-label={t("zoomOut")} className="grid size-11 place-items-center hover:bg-accent focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring" onClick={() => zoom(-1)} type="button">
              <Minus aria-hidden className="size-4" />
            </button>
          </div>
          {movedCenter && (
            <button
              className="absolute left-1/2 top-3 z-10 flex min-h-11 max-w-[calc(100%-7rem)] -translate-x-1/2 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-center text-sm font-medium text-card-foreground shadow-md transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() => {
                setMovement(null);
                setPopupId(null);
                onSearchArea(movedCenter);
              }}
              type="button"
            >
              <Search aria-hidden className="size-3.5 shrink-0" />
              {t("searchArea")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
