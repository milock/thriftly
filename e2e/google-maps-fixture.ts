import type { Page } from "@playwright/test";

export const googleMapsBootstrap = /^https:\/\/maps\.googleapis\.com\/maps\/api\/js\?/;

// This supplies the SDK contract for interaction tests. Live provider assertions
// run separately in google-provider.spec.ts without any map or rating routes.
const sdk = String.raw`
(() => {
  const makePane = () => {
    const node = document.createElement("div");
    node.style.cssText = "position:absolute;top:0;left:0";
    return node;
  };

  class FixtureMap {
    constructor(div, options) {
      this.div = div;
      this.center = options.center;
      this.zoom = options.zoom;
      this.scale = 1000;
      this.events = new Map();
      this.overlays = new Set();
      this.panes = {
        markerLayer: makePane(),
        overlayMouseTarget: makePane(),
        floatPane: makePane(),
      };

      const surface = document.createElement("div");
      surface.dataset.fixtureMapInteraction = "";
      surface.tabIndex = 0;
      surface.style.cssText = "position:absolute;inset:0;background:#e9eef0";
      surface.addEventListener("click", () => this.emit("click"));
      surface.addEventListener("keydown", event => {
        const deltas = { ArrowLeft: [0, -.04], ArrowRight: [0, .04], ArrowUp: [.04, 0], ArrowDown: [-.04, 0] };
        if (!deltas[event.key]) return;
        event.preventDefault();
        const [lat, lng] = deltas[event.key];
        this.center = { lat: this.center.lat + lat, lng: this.center.lng + lng };
        this.redraw();
      });
      div.append(surface, ...Object.values(this.panes));
      this.setOptions(options);
      setTimeout(() => this.emit("tilesloaded"), 0);
    }

    addListener(name, callback) {
      const callbacks = this.events.get(name) || new Set();
      this.events.set(name, callbacks);
      callbacks.add(callback);
      return { remove: () => callbacks.delete(callback) };
    }
    emit(name) { this.events.get(name)?.forEach(callback => callback()); }
    getDiv() { return this.div; }
    getCenter() { return { lat: () => this.center.lat, lng: () => this.center.lng }; }
    getZoom() { return this.zoom; }
    getBounds() {
      return { contains: point => {
        const { x, y } = this.project(point);
        return x >= 0 && y >= 0 && x <= this.div.clientWidth && y <= this.div.clientHeight;
      } };
    }
    setOptions(options) {
      if (options.styles) this.div.dataset.fixtureMapTheme = options.styles.length ? "dark" : "light";
    }
    setZoom(zoom) { this.zoom = zoom; this.redraw(); }
    moveCamera({ center, zoom }) { this.center = center; this.zoom = zoom; this.redraw(); }
    fitBounds(bounds, padding) {
      this.center = bounds.center;
      this.scale = Math.max(250, (Math.min(this.div.clientHeight, this.div.clientWidth) - padding * 2) / (bounds.radius / 55500));
      this.redraw();
    }
    project({ lat, lng }) {
      return {
        x: this.div.clientWidth / 2 + (lng - this.center.lng) * this.scale,
        y: this.div.clientHeight / 2 - (lat - this.center.lat) * this.scale,
      };
    }
    redraw() {
      this.overlays.forEach(overlay => overlay.draw());
      this.emit("idle");
    }
  }

  class FixtureCircle {
    constructor(options) { this.setOptions(options); }
    setOptions(options) { Object.assign(this, options); }
    getBounds() { return this.center ? { center: this.center, radius: this.radius } : null; }
    setMap(map) { this.map = map; }
  }

  class FixtureOverlay {
    static preventMapHitsFrom() {}
    static preventMapHitsAndGesturesFrom() {}
    setMap(map) {
      if (this.map) {
        this.map.overlays.delete(this);
        this.onRemove();
      }
      this.map = map;
      if (!map) return;
      map.overlays.add(this);
      this.onAdd();
      this.draw();
    }
    getPanes() { return this.map.panes; }
    getProjection() {
      const project = point => this.map.project(point);
      return { fromLatLngToDivPixel: project, fromLatLngToContainerPixel: project };
    }
  }

  const maps = window.google.maps;
  maps.importLibrary = async library => {
    if (library !== "maps") throw new Error("Unexpected Google SDK library: " + library);
    return { Map: FixtureMap, Circle: FixtureCircle, OverlayView: FixtureOverlay };
  };
  maps.__ib__();
})();
`;

export async function mockGoogleMaps(page: Page) {
  await page.route(googleMapsBootstrap, route => route.fulfill({
    contentType: "application/javascript",
    body: sdk,
  }));
}
