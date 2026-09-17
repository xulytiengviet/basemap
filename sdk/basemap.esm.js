/* Long Ngo Basemap SDK ESM - MIT - Copyright (c) 2026 Long Ngo */
export const version = "1.2.0";
export const archive = "https://github.com/xulytiengviet/basemap/releases/latest/download/basemap.pmtiles";
export const bounds = [[91.93359375, -2.02106512], [126.03515625, 26.03704189]];
export const center = [108.984375, 12.0079884];
export const minZoom = 3;
export const maxZoom = 12;

const MAPLIBRE_VERSION = "5.13.0";
const PMTILES_VERSION = "4.5.0";
const MAPLIBRE_CSS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
let depsPromise;
let protocolRegistered = false;

function ensureCss(url) {
  if (typeof document === "undefined") return;
  if (Array.from(document.styleSheets || []).some((sheet) => sheet.href === url)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);
}

async function dependencies() {
  if (!depsPromise) {
    depsPromise = (async () => {
      ensureCss(MAPLIBRE_CSS);
      const [maplibreModule, pmtilesModule] = await Promise.all([
        import(`https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/+esm`),
        import(`https://cdn.jsdelivr.net/npm/pmtiles@${PMTILES_VERSION}/+esm`)
      ]);
      const maplibregl = maplibreModule.default || maplibreModule;
      if (!protocolRegistered) {
        const protocol = new pmtilesModule.Protocol({ metadata: true });
        maplibregl.addProtocol("pmtiles", protocol.tile);
        protocolRegistered = true;
      }
      return { maplibregl, pmtiles: pmtilesModule };
    })();
  }
  return depsPromise;
}

function targetElement(target, height) {
  const el = typeof target === "string" ? document.getElementById(target) : target;
  if (!el) throw new Error(`LongNgoBasemap target not found: ${String(target)}`);
  if (!el.style.width) el.style.width = "100%";
  if (!el.style.height && !getComputedStyle(el).height.match(/^[1-9]/)) el.style.height = height || "480px";
  return el;
}

function styleFor(url, attribution) {
  return {
    version: 8,
    sources: {
      longngo_basemap: {
        type: "raster",
        url: `pmtiles://${url}`,
        tileSize: 256,
        minzoom: minZoom,
        maxzoom: maxZoom,
        attribution: attribution || "Long Ngo Basemap"
      }
    },
    layers: [{ id: "longngo_basemap", type: "raster", source: "longngo_basemap" }]
  };
}

export async function create(options = {}) {
  const { maplibregl } = await dependencies();
  const map = new maplibregl.Map({
    container: targetElement(options.target || options.container || "map", options.height),
    center: options.center || center,
    zoom: options.zoom ?? 5,
    minZoom: options.minZoom ?? minZoom,
    maxZoom: options.maxZoom ?? maxZoom,
    style: options.style || styleFor(options.archive || archive, options.attribution),
    attributionControl: options.attributionControl !== false,
    hash: options.hash === true
  });
  if (options.navigation !== false) map.addControl(new maplibregl.NavigationControl(), "top-right");
  if (options.scale === true) map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
  if (options.fitBounds === true) map.once("load", () => map.fitBounds(options.bounds || bounds, { padding: 20, duration: 0 }));
  return map;
}

export const addTo = create;

export async function getMetadata(url = archive) {
  const { pmtiles } = await dependencies();
  const p = new pmtiles.PMTiles(url);
  const [header, metadata] = await Promise.all([p.getHeader(), p.getMetadata()]);
  return { header, metadata, archive: url };
}

export async function ready() {
  await dependencies();
  return api;
}

const api = { version, archive, bounds, center, minZoom, maxZoom, create, addTo, getMetadata, ready };
export default api;
