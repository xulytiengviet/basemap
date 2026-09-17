import { PMTiles } from "pmtiles";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

const VERSION = "1.0.0";
const DEFAULT_ARCHIVE = "https://github.com/xulytiengviet/basemap/releases/latest/download/basemap.pmtiles";
const FALLBACK_BOUNDS = [91.93359375, -2.02106512, 126.03515625, 26.03704189];
const FALLBACK_CENTER = [108.984375, 12.0079884, 5];
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
    "Access-Control-Allow-Headers": "Content-Type,Range,If-None-Match,Accept,MCP-Protocol-Version",
    "Access-Control-Expose-Headers": "Accept-Ranges,Content-Range,Content-Length,ETag,Cache-Control",
    ...extra,
  };
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: corsHeaders({ "Content-Type": "application/json; charset=utf-8", ...extra }),
  });
}

function publicBase(request) {
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

function headerBounds(h) {
  if (Array.isArray(h.bounds)) return h.bounds;
  const vals = [h.minLon, h.minLat, h.maxLon, h.maxLat];
  return vals.every(Number.isFinite) ? vals : FALLBACK_BOUNDS;
}

function headerCenter(h) {
  if (Array.isArray(h.center)) return h.center;
  if (Number.isFinite(h.centerLon) && Number.isFinite(h.centerLat)) {
    return [h.centerLon, h.centerLat, h.centerZoom ?? 5];
  }
  return FALLBACK_CENTER;
}

function lonLatToTile(lon, lat, z) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n);
  return { z, x, y };
}

function tileUrl(base, z, x, y) {
  return `${base}/tiles/${z}/${x}/${y}.png`;
}

async function metadataPayload(env, request) {
  const p = getArchive(env);
  const [header, metadata] = await Promise.all([p.getHeader(), p.getMetadata()]);
  const base = publicBase(request);
  return {
    service: env.SERVICE_NAME || "Long Ngo Basemap Open Gateway",
    version: VERSION,
    author: env.AUTHOR || "Long Ngo",
    software_license: env.LICENSE || "MIT",
    archive: archiveUrl(env),
    pmtiles: `${base}/basemap.pmtiles`,
    tilejson: `${base}/tilejson.json`,
    xyz_template: `${base}/tiles/{z}/{x}/{y}.png`,
    mcp: `${base}/mcp`,
    header,
    metadata,
  };
}

async function tileJson(env, request) {
  const p = getArchive(env);
  const [header, metadata] = await Promise.all([p.getHeader(), p.getMetadata()]);
  const base = publicBase(request);
  const bounds = headerBounds(header);
  const center = headerCenter(header);
  return {
    tilejson: "3.0.0",
    name: metadata?.name || "Long Ngo Basemap",
    description: metadata?.description || "Raster PMTiles basemap served by Long Ngo Basemap Open Gateway",
    attribution: metadata?.attribution || "Basemap gateway developed by Long Ngo",
    scheme: "xyz",
    tiles: [`${base}/tiles/{z}/{x}/{y}.png`],
    minzoom: header.minZoom ?? 3,
    maxzoom: header.maxZoom ?? 12,
    bounds,
    center,
  };
}

async function proxyArchive(request, env) {
  const upstream = new URL(archiveUrl(env));
  const headers = new Headers();
  for (const name of ["Range", "If-Range", "If-None-Match", "If-Modified-Since", "Accept-Encoding"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const res = await fetch(upstream, { method: request.method === "HEAD" ? "HEAD" : "GET", headers, redirect: "follow" });
  const out = new Headers(res.headers);
  Object.entries(corsHeaders({
    "Accept-Ranges": "bytes",
    "Cache-Control": res.headers.get("Cache-Control") || "public, max-age=86400, s-maxage=604800, immutable",
  })).forEach(([k, v]) => out.set(k, v));
  return new Response(request.method === "HEAD" ? null : res.body, { status: res.status, statusText: res.statusText, headers: out });
}

async function serveTile(z, x, y, env) {
  const p = getArchive(env);
  const tile = await p.getZxy(z, x, y);
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
    const server = new McpServer({ name: "longngo-basemap", version: VERSION });

    server.registerTool(
      "get_basemap_metadata",
      { description: "Return PMTiles header, metadata, bounds, zoom range and public basemap endpoints." },
      async () => ({ content: [{ type: "text", text: JSON.stringify(await metadataPayload(env, request), null, 2) }] })
    );

    server.registerTool(
      "lonlat_to_tile",
      {
        description: "Convert WGS84 longitude/latitude to XYZ tile coordinates and return a public PNG tile URL.",
        inputSchema: z.object({
          lon: z.number().min(-180).max(180),
          lat: z.number().min(-85.05112878).max(85.05112878),
          zoom: z.number().int().min(0).max(22),
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
        description: "Create a public XYZ PNG URL for a z/x/y tile.",
        inputSchema: z.object({
          z: z.number().int().min(0).max(22),
          x: z.number().int().nonnegative(),
          y: z.number().int().nonnegative(),
        }),
      },
      async ({ z, x, y }) => ({ content: [{ type: "text", text: tileUrl(base, z, x, y) }] })
    );

    server.registerTool(
      "get_service_endpoints",
      { description: "List REST, CDN, TileJSON, XYZ, OpenAPI and MCP endpoints exposed by this basemap gateway." },
      async () => ({
        content: [{
          type: "text",
          text: JSON.stringify({
            home: `${base}/`,
            health: `${base}/healthz`,
            metadata: `${base}/api/v1/metadata`,
            tilejson: `${base}/tilejson.json`,
            pmtiles_cdn: `${base}/basemap.pmtiles`,
            xyz: `${base}/tiles/{z}/{x}/{y}.png`,
            openapi: `${base}/openapi.json`,
            mcp: `${base}/mcp`,
          }, null, 2),
        }],
      })
    );

    return server;
  }, { responseMode: "json" });
}

function serviceIndex(request, env) {
  const base = publicBase(request);
  return {
    name: env.SERVICE_NAME || "Long Ngo Basemap Open Gateway",
    version: VERSION,
    developer: "Long Ngo",
    license: "MIT",
    description: "Open serverless gateway for a raster PMTiles basemap: CDN/Range, REST, XYZ, TileJSON and MCP for AI agents.",
    ports: { public_https: 443, local_wrangler: 8787 },
    endpoints: {
      pmtiles: `${base}/basemap.pmtiles`,
      metadata: `${base}/api/v1/metadata`,
      tilejson: `${base}/tilejson.json`,
      xyz: `${base}/tiles/{z}/{x}/{y}.png`,
      health: `${base}/healthz`,
      openapi: `${base}/openapi.json`,
      mcp: `${base}/mcp`,
      well_known: `${base}/.well-known/basemap.json`,
    },
  };
}

function openApi(request) {
  const base = publicBase(request);
  return {
    openapi: "3.1.0",
    info: { title: "Long Ngo Basemap Open Gateway", version: VERSION, license: { name: "MIT" } },
    servers: [{ url: base }],
    paths: {
      "/healthz": { get: { summary: "Health check", responses: { "200": { description: "OK" } } } },
      "/api/v1/metadata": { get: { summary: "PMTiles metadata and service endpoints", responses: { "200": { description: "Metadata" } } } },
      "/tilejson.json": { get: { summary: "TileJSON document", responses: { "200": { description: "TileJSON" } } } },
      "/basemap.pmtiles": { get: { summary: "HTTP Range/CDN proxy to the PMTiles archive", responses: { "200": { description: "Archive" }, "206": { description: "Partial content" } } } },
      "/tiles/{z}/{x}/{y}.png": { get: { summary: "XYZ raster tile", parameters: ["z", "x", "y"].map((name) => ({ name, in: "path", required: true, schema: { type: "integer" } })), responses: { "200": { description: "PNG tile" }, "404": { description: "Tile not found" } } } },
      "/mcp": { post: { summary: "MCP Streamable HTTP endpoint", responses: { "200": { description: "MCP JSON-RPC response" } } } },
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
        const handler = makeMcpHandler(env, request);
        return await handler.fetch(request);
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        return json({ error: "method_not_allowed" }, 405, { Allow: "GET, HEAD, OPTIONS" });
      }

      if (path === "/") return json(serviceIndex(request, env));
      if (path === "/healthz" || path === "/api/v1/health") return json({ ok: true, service: "longngo-basemap", version: VERSION });
      if (path === "/api/v1" || path === "/.well-known/basemap.json") return json(serviceIndex(request, env));
      if (path === "/api/v1/metadata" || path === "/metadata.json") return json(await metadataPayload(env, request));
      if (path === "/tilejson.json" || path === "/api/v1/tilejson.json") return json(await tileJson(env, request));
      if (path === "/openapi.json" || path === "/api/openapi.json") return json(openApi(request));
      if (path === "/basemap.pmtiles" || path === "/cdn/basemap.pmtiles" || path === "/api/v1/basemap.pmtiles") return proxyArchive(request, env);

      const match = path.match(/^\/(?:tiles|api\/v1\/tiles)\/(\d+)\/(\d+)\/(\d+)\.png$/);
      if (match) {
        const [z, x, y] = match.slice(1).map(Number);
        if (![z, x, y].every(Number.isSafeInteger) || z < 0 || z > 22 || x < 0 || y < 0) return json({ error: "invalid_tile_coordinate" }, 400);
        return serveTile(z, x, y, env);
      }

      if (path === "/api/v1/lonlat-to-tile") {
        const lon = Number(url.searchParams.get("lon"));
        const lat = Number(url.searchParams.get("lat"));
        const z = Number(url.searchParams.get("z"));
        if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isInteger(z)) return json({ error: "query_required", example: "/api/v1/lonlat-to-tile?lon=106.7&lat=10.8&z=10" }, 400);
        const t = lonLatToTile(lon, lat, z);
        return json({ ...t, url: tileUrl(publicBase(request), t.z, t.x, t.y) });
      }

      return json({ error: "not_found", index: `${publicBase(request)}/` }, 404);
    } catch (error) {
      return json({ error: "gateway_error", message: error instanceof Error ? error.message : String(error) }, 502);
    }
  },
};
