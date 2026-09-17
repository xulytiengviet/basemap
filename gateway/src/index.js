import { PMTiles } from "pmtiles";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { landingHtml, webgisHtml } from "./webgis.js";

const VERSION = "1.1.0";
const DEFAULT_ARCHIVE = "https://github.com/xulytiengviet/basemap/releases/latest/download/basemap.pmtiles";
const FALLBACK_BOUNDS = [91.93359375, -2.02106512, 126.03515625, 26.03704189];
const FALLBACK_CENTER = [108.984375, 12.0079884, 7];
const DATA_MIN_ZOOM = 3;
const DATA_MAX_ZOOM = 12;
const WEB_MERCATOR_MAX_LAT = 85.05112878;
const archives = new Map();

function archiveUrl(env) {
  return env.PMTILES_URL || DEFAULT_ARCHIVE;
}

function getArchive(env) {
  const url = archiveUrl(env);
  if (!archives.has(url)) archives.set(url, new PMTiles(url));
  return archives.get(url);
}

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS,POST",
    "Access-Control-Allow-Headers": "Content-Type,Range,If-Range,If-None-Match,Accept,Authorization,MCP-Protocol-Version,Last-Event-ID",
    "Access-Control-Expose-Headers": "Accept-Ranges,Content-Range,Content-Length,ETag,Cache-Control,MCP-Protocol-Version",
    ...extra,
  };
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: corsHeaders({ "Content-Type": "application/json; charset=utf-8", ...extra }),
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: corsHeaders({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" }),
  });
}

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function publicBase(request) {
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

function headerBounds(h) {
  const vals = [h.minLon, h.minLat, h.maxLon, h.maxLat];
  return vals.every(Number.isFinite) ? vals : FALLBACK_BOUNDS;
}

function headerCenter(h) {
  if (Number.isFinite(h.centerLon) && Number.isFinite(h.centerLat)) {
    return [h.centerLon, h.centerLat, h.centerZoom ?? 7];
  }
  return FALLBACK_CENTER;
}

function validateLonLatZoom(lon, lat, z) {
  return Number.isFinite(lon) && lon >= -180 && lon <= 180 &&
    Number.isFinite(lat) && lat >= -WEB_MERCATOR_MAX_LAT && lat <= WEB_MERCATOR_MAX_LAT &&
    Number.isInteger(z) && z >= DATA_MIN_ZOOM && z <= DATA_MAX_ZOOM;
}

function validateTile(z, x, y) {
  if (![z, x, y].every(Number.isSafeInteger)) return false;
  if (z < DATA_MIN_ZOOM || z > DATA_MAX_ZOOM) return false;
  const n = 2 ** z;
  return x >= 0 && y >= 0 && x < n && y < n;
}

function lonLatToTile(lon, lat, z) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n);
  return { z, x: Math.min(n - 1, Math.max(0, x)), y: Math.min(n - 1, Math.max(0, y)) };
}

function tileUrl(base, z, x, y) {
  return `${base}/tiles/${z}/${x}/${y}.png`;
}

function serviceIndex(request, env) {
  const base = publicBase(request);
  return {
    name: env.SERVICE_NAME || "Long Ngo Basemap Open Gateway",
    version: VERSION,
    developer: env.AUTHOR || "Long Ngo",
    code_license: env.LICENSE || "MIT",
    source: "https://github.com/xulytiengviet/basemap",
    release: "https://github.com/xulytiengviet/basemap/releases/tag/v1.1.0",
    webgis: `${base}/webgis`,
    ports: { public_https: 443, local_wrangler: 8787 },
    endpoints: {
      pmtiles: `${base}/basemap.pmtiles`,
      metadata: `${base}/api/v1/metadata`,
      lonlat_to_tile: `${base}/api/v1/lonlat-to-tile?lon=106.7&lat=10.8&z=10`,
      tilejson: `${base}/tilejson.json`,
      xyz: `${base}/tiles/{z}/{x}/{y}.png`,
      health: `${base}/healthz`,
      openapi: `${base}/openapi.json`,
      mcp: `${base}/mcp`,
      discovery: `${base}/.well-known/basemap.json`,
    },
  };
}

async function metadataPayload(env, request) {
  const p = getArchive(env);
  const [header, metadata] = await Promise.all([p.getHeader(), p.getMetadata()]);
  const base = publicBase(request);
  return {
    ...serviceIndex(request, env),
    archive_upstream: archiveUrl(env),
    bounds: headerBounds(header),
    center: headerCenter(header),
    minzoom: header.minZoom,
    maxzoom: header.maxZoom,
    addressed_tiles: header.numAddressedTiles,
    tile_entries: header.numTileEntries,
    unique_tile_contents: header.numTileContents,
    pmtiles_spec_version: header.specVersion,
    clustered: header.clustered,
    tile_type: header.tileType,
    header,
    metadata,
    canonical_pmtiles: `${base}/basemap.pmtiles`,
  };
}

async function tileJson(env, request) {
  const p = getArchive(env);
  const [header, metadata] = await Promise.all([p.getHeader(), p.getMetadata()]);
  const base = publicBase(request);
  return {
    tilejson: "3.0.0",
    name: metadata?.name || "Long Ngo Basemap",
    description: metadata?.description || "Raster PMTiles basemap served by Long Ngo Basemap Open Gateway",
    attribution: metadata?.attribution || "Basemap gateway developed by Long Ngo",
    scheme: "xyz",
    tiles: [`${base}/tiles/{z}/{x}/{y}.png`],
    minzoom: header.minZoom ?? DATA_MIN_ZOOM,
    maxzoom: header.maxZoom ?? DATA_MAX_ZOOM,
    bounds: headerBounds(header),
    center: headerCenter(header),
  };
}

async function proxyArchive(request, env) {
  const upstream = new URL(archiveUrl(env));
  const headers = new Headers();
  for (const name of ["Range", "If-Range", "If-None-Match", "If-Modified-Since", "Accept-Encoding"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const res = await fetch(upstream, {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers,
    redirect: "follow",
  });
  const out = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders({
    "Accept-Ranges": "bytes",
    "Cache-Control": res.headers.get("Cache-Control") || "public, max-age=86400, s-maxage=604800, immutable",
  }))) out.set(k, v);
  return new Response(request.method === "HEAD" ? null : res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: out,
  });
}

async function serveTile(z, x, y, env) {
  const tile = await getArchive(env).getZxy(z, x, y);
  if (!tile) return json({ error: "tile_not_found", z, x, y }, 404);
  return new Response(tile.data, {
    status: 200,
    headers: corsHeaders({
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=604800, s-maxage=2592000, immutable",
      "X-Basemap-Z": String(z),
      "X-Basemap-X": String(x),
      "X-Basemap-Y": String(y),
    }),
  });
}

function allowedMcpOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  const allowed = (env.MCP_ALLOWED_ORIGINS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

function makeMcpHandler(env, request) {
  const base = publicBase(request);
  return createMcpHandler(() => {
    const server = new McpServer(
      { name: "longngo-basemap", version: VERSION },
      { instructions: "Public geospatial basemap service. Use zoom levels 3 through 12 for this archive." }
    );

    server.registerTool(
      "get_basemap_metadata",
      { description: "Return PMTiles metadata, bounds, zoom range and public service endpoints." },
      async () => ({ content: [{ type: "text", text: JSON.stringify(await metadataPayload(env, request), null, 2) }] })
    );

    server.registerTool(
      "lonlat_to_tile",
      {
        description: "Convert a WGS84 coordinate to an XYZ tile and public PNG URL for this basemap.",
        inputSchema: z.object({
          lon: z.number().min(-180).max(180),
          lat: z.number().min(-WEB_MERCATOR_MAX_LAT).max(WEB_MERCATOR_MAX_LAT),
          zoom: z.number().int().min(DATA_MIN_ZOOM).max(DATA_MAX_ZOOM),
        }),
      },
      async ({ lon, lat, zoom }) => {
        const t = lonLatToTile(lon, lat, zoom);
        return { content: [{ type: "text", text: JSON.stringify({ ...t, url: tileUrl(base, t.z, t.x, t.y) }, null, 2) }] };
      }
    );

    server.registerTool(
      "get_tile_url",
      {
        description: "Create a public XYZ PNG URL for a valid z/x/y tile.",
        inputSchema: z.object({
          z: z.number().int().min(DATA_MIN_ZOOM).max(DATA_MAX_ZOOM),
          x: z.number().int().nonnegative(),
          y: z.number().int().nonnegative(),
        }),
      },
      async ({ z, x, y }) => {
        if (!validateTile(z, x, y)) throw new Error("Invalid tile coordinate for this zoom level");
        return { content: [{ type: "text", text: tileUrl(base, z, x, y) }] };
      }
    );

    server.registerTool(
      "get_service_endpoints",
      { description: "List WebGIS, REST, CDN, TileJSON, XYZ, OpenAPI and MCP endpoints." },
      async () => ({ content: [{ type: "text", text: JSON.stringify(serviceIndex(request, env), null, 2) }] })
    );

    return server;
  }, { responseMode: "json" });
}

function openApi(request) {
  const base = publicBase(request);
  return {
    openapi: "3.1.0",
    info: {
      title: "Long Ngo Basemap Open Gateway",
      version: VERSION,
      description: "Public WebGIS/API/CDN gateway for basemap.pmtiles",
      license: { name: "MIT" },
    },
    servers: [{ url: base }],
    paths: {
      "/healthz": { get: { summary: "Health check", responses: { "200": { description: "OK" } } } },
      "/api/v1/metadata": { get: { summary: "PMTiles metadata and service endpoints", responses: { "200": { description: "Metadata" } } } },
      "/api/v1/lonlat-to-tile": { get: { summary: "Convert WGS84 lon/lat to XYZ", responses: { "200": { description: "Tile coordinate" } } } },
      "/tilejson.json": { get: { summary: "TileJSON document", responses: { "200": { description: "TileJSON" } } } },
      "/basemap.pmtiles": { get: { summary: "HTTP Range/CDN proxy", responses: { "200": { description: "Archive" }, "206": { description: "Partial content" } } } },
      "/tiles/{z}/{x}/{y}.png": { get: { summary: "XYZ raster PNG tile", responses: { "200": { description: "PNG tile" }, "404": { description: "Tile not found" } } } },
      "/mcp": { post: { summary: "MCP Streamable HTTP endpoint", responses: { "200": { description: "MCP response" } } } },
    },
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });

    try {
      if (path === "/mcp") {
        if (request.method !== "POST") return json({ error: "method_not_allowed", allow: ["POST"] }, 405, { Allow: "POST" });
        if (!allowedMcpOrigin(request, env)) return json({ error: "forbidden_origin" }, 403);
        return withCors(await makeMcpHandler(env, request).fetch(request));
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        return json({ error: "method_not_allowed" }, 405, { Allow: "GET, HEAD, OPTIONS" });
      }

      const base = publicBase(request);
      if (path === "/") return html(landingHtml(base));
      if (path === "/webgis" || path === "/map") return html(webgisHtml(base));
      if (path === "/healthz" || path === "/api/v1/health") return json({ ok: true, service: "longngo-basemap", version: VERSION, archive: archiveUrl(env) });
      if (path === "/api/v1" || path === "/.well-known/basemap.json") return json(serviceIndex(request, env));
      if (path === "/api/v1/metadata" || path === "/metadata.json") return json(await metadataPayload(env, request));
      if (path === "/tilejson.json" || path === "/api/v1/tilejson.json") return json(await tileJson(env, request));
      if (path === "/openapi.json" || path === "/api/openapi.json") return json(openApi(request));
      if (path === "/basemap.pmtiles" || path === "/cdn/basemap.pmtiles" || path === "/api/v1/basemap.pmtiles") return proxyArchive(request, env);

      const match = path.match(/^\/(?:tiles|api\/v1\/tiles)\/(\d+)\/(\d+)\/(\d+)\.png$/);
      if (match) {
        const [z, x, y] = match.slice(1).map(Number);
        if (!validateTile(z, x, y)) return json({ error: "invalid_tile_coordinate", zoom_range: [DATA_MIN_ZOOM, DATA_MAX_ZOOM] }, 400);
        return serveTile(z, x, y, env);
      }

      if (path === "/api/v1/lonlat-to-tile") {
        const lon = Number(url.searchParams.get("lon"));
        const lat = Number(url.searchParams.get("lat"));
        const z = Number(url.searchParams.get("z"));
        if (!validateLonLatZoom(lon, lat, z)) {
          return json({ error: "invalid_query", constraints: { lon: [-180, 180], lat: [-WEB_MERCATOR_MAX_LAT, WEB_MERCATOR_MAX_LAT], zoom: [DATA_MIN_ZOOM, DATA_MAX_ZOOM] }, example: "/api/v1/lonlat-to-tile?lon=106.7&lat=10.8&z=10" }, 400);
        }
        const t = lonLatToTile(lon, lat, z);
        return json({ ...t, url: tileUrl(base, t.z, t.x, t.y) });
      }

      return json({ error: "not_found", index: `${base}/`, webgis: `${base}/webgis` }, 404);
    } catch (error) {
      return json({ error: "gateway_error", message: error instanceof Error ? error.message : String(error) }, 502);
    }
  },
};
