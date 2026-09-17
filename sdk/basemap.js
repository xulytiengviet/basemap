/*
 * Long Ngo Basemap SDK
 * MIT License - Copyright (c) 2026 Long Ngo
 *
 * One-line embed:
 * <div id="map"></div>
 * <script src="https://cdn.jsdelivr.net/gh/xulytiengviet/basemap@v1.2.0/sdk/basemap.min.js" data-target="map"></script>
 */
(function (global) {
  "use strict";

  const VERSION = "1.2.0";
  const ARCHIVE_URL = "https://github.com/xulytiengviet/basemap/releases/latest/download/basemap.pmtiles";
  const MAPLIBRE_VERSION = "5.13.0";
  const PMTILES_VERSION = "4.5.0";
  const MAPLIBRE_JS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
  const MAPLIBRE_CSS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
  const PMTILES_JS = `https://cdn.jsdelivr.net/npm/pmtiles@${PMTILES_VERSION}/dist/pmtiles.js`;
  const DEFAULT_CENTER = [108.984375, 12.0079884];
  const DEFAULT_ZOOM = 5;
  const DEFAULT_BOUNDS = [[91.93359375, -2.02106512], [126.03515625, 26.03704189]];
  const MIN_ZOOM = 3;
  const MAX_ZOOM = 12;

  let depsPromise;
  let protocolRegistered = false;
  let protocolInstance;
  const bootScript = typeof document !== "undefined" ? document.currentScript : null;

  function loadCss(url) {
    if (typeof document === "undefined") return Promise.resolve();
    const existing = Array.from(document.styleSheets || []).some((sheet) => sheet.href === url);
    if (existing) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.crossOrigin = "anonymous";
      link.onload = resolve;
      link.onerror = () => reject(new Error(`Failed to load CSS: ${url}`));
      document.head.appendChild(link);
    });
  }

  function loadScript(url, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${url}"]`);
      if (existing) {
        if (ready()) return resolve();
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed to load script: ${url}`)), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
      document.head.appendChild(script);
    });
  }

  function ensureDependencies() {
    if (depsPromise) return depsPromise;
    if (typeof document === "undefined") {
      return Promise.reject(new Error("LongNgoBasemap browser SDK requires document/window."));
    }
    depsPromise = (async () => {
      await Promise.all([
        loadCss(MAPLIBRE_CSS),
        loadScript(MAPLIBRE_JS, () => !!global.maplibregl),
        loadScript(PMTILES_JS, () => !!global.pmtiles)
      ]);
      if (!global.maplibregl || !global.pmtiles) throw new Error("MapLibre or PMTiles dependency unavailable.");
      if (!protocolRegistered) {
        protocolInstance = new global.pmtiles.Protocol({ metadata: true });
        global.maplibregl.addProtocol("pmtiles", protocolInstance.tile);
        protocolRegistered = true;
      }
      return { maplibregl: global.maplibregl, pmtiles: global.pmtiles };
    })();
    return depsPromise;
  }

  function resolveContainer(target, height) {
    const element = typeof target === "string" ? document.getElementById(target) : target;
    if (!element) throw new Error(`LongNgoBasemap target not found: ${String(target)}`);
    if (!element.style.width) element.style.width = "100%";
    if (!element.style.height && !getComputedStyle(element).height.match(/^[1-9]/)) {
      element.style.height = height || "480px";
    }
    return element;
  }

  function normalizeCenter(center) {
    if (Array.isArray(center) && center.length >= 2) return [Number(center[0]), Number(center[1])];
    if (typeof center === "string") {
      const parts = center.split(",").map(Number);
      if (parts.length >= 2 && parts.every(Number.isFinite)) return [parts[0], parts[1]];
    }
    return DEFAULT_CENTER.slice();
  }

  function rasterStyle(archive, attribution) {
    return {
      version: 8,
      sources: {
        longngo_basemap: {
          type: "raster",
          url: `pmtiles://${archive}`,
          tileSize: 256,
          minzoom: MIN_ZOOM,
          maxzoom: MAX_ZOOM,
          attribution: attribution || "Long Ngo Basemap"
        }
      },
      layers: [{ id: "longngo_basemap", type: "raster", source: "longngo_basemap" }]
    };
  }

  async function create(options) {
    options = options || {};
    const { maplibregl } = await ensureDependencies();
    const element = resolveContainer(options.target || options.container || "map", options.height);
    const center = normalizeCenter(options.center);
    const zoom = Number.isFinite(Number(options.zoom)) ? Number(options.zoom) : DEFAULT_ZOOM;
    const archive = options.archive || ARCHIVE_URL;

    const map = new maplibregl.Map({
      container: element,
      center,
      zoom,
      minZoom: options.minZoom == null ? MIN_ZOOM : Number(options.minZoom),
      maxZoom: options.maxZoom == null ? MAX_ZOOM : Number(options.maxZoom),
      style: options.style || rasterStyle(archive, options.attribution),
      attributionControl: options.attributionControl !== false,
      hash: options.hash === true
    });

    if (options.navigation !== false) map.addControl(new maplibregl.NavigationControl(), "top-right");
    if (options.scale === true) map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    const shouldFit = options.fitBounds === true;
    if (shouldFit) {
      map.once("load", () => map.fitBounds(options.bounds || DEFAULT_BOUNDS, { padding: 20, duration: 0 }));
    }

    return map;
  }

  async function getMetadata(archive) {
    const { pmtiles } = await ensureDependencies();
    const p = new pmtiles.PMTiles(archive || ARCHIVE_URL);
    const [header, metadata] = await Promise.all([p.getHeader(), p.getMetadata()]);
    return { header, metadata, archive: archive || ARCHIVE_URL };
  }

  async function ready() {
    await ensureDependencies();
    return api;
  }

  const api = {
    version: VERSION,
    archive: ARCHIVE_URL,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    bounds: DEFAULT_BOUNDS,
    center: DEFAULT_CENTER,
    create,
    addTo: create,
    getMetadata,
    ready
  };

  global.LongNgoBasemap = api;

  function bootFromDataAttributes() {
    if (!bootScript || !bootScript.dataset || !bootScript.dataset.target) return;
    const dataset = bootScript.dataset;
    const options = {
      target: dataset.target,
      center: dataset.center,
      zoom: dataset.zoom == null ? undefined : Number(dataset.zoom),
      height: dataset.height,
      archive: dataset.archive,
      navigation: dataset.navigation !== "false",
      scale: dataset.scale === "true",
      fitBounds: dataset.fitBounds === "true",
      hash: dataset.hash === "true"
    };
    create(options).then((map) => {
      global.LongNgoBasemap.map = map;
      if (typeof global.CustomEvent === "function") {
        global.dispatchEvent(new CustomEvent("longngo-basemap-ready", { detail: { map, sdk: api } }));
      }
    }).catch((error) => console.error("[LongNgoBasemap]", error));
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootFromDataAttributes, { once: true });
    else bootFromDataAttributes();
  }
})(typeof window !== "undefined" ? window : globalThis);
