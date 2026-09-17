# Go-live checklist — Basemap v1.0.0

**Developer:** Long Ngo  
**Code license:** MIT  
**Release:** `v1.0.0`

## 1. Attach the binary assets to GitHub Release v1.0.0

Open:

`https://github.com/xulytiengviet/basemap/releases/tag/v1.0.0`

Choose **Edit release** and upload these three files:

1. `basemap.pmtiles`
2. `basemap.info.json`
3. `basemap.pmtiles.sha256`

Expected SHA-256 for `basemap.pmtiles`:

`ff62a0549c722905ec30538fd4336bc93960e9a593c0eabe99600bc40ecbe77c`

After publishing, the stable latest URL must resolve:

`https://github.com/xulytiengviet/basemap/releases/latest/download/basemap.pmtiles`

Version-pinned URL:

`https://github.com/xulytiengviet/basemap/releases/download/v1.0.0/basemap.pmtiles`

## 2. Verify the public PMTiles archive

From the repository, run GitHub Actions → **Verify public basemap** → **Run workflow**.

Or locally:

```bash
PMTILES_URL=https://github.com/xulytiengviet/basemap/releases/latest/download/basemap.pmtiles \
  bash scripts/check_public_basemap.sh
```

The check validates:

- public download URL
- byte-range request
- `PMTiles` magic bytes
- PMTiles v3 header

## 3. Deploy the Open Gateway

The gateway is in `gateway/`.

Local development:

```bash
cd gateway
npm install
npm run dev
```

Local endpoint:

`http://localhost:8787`

Deploy to Cloudflare Workers:

```bash
npx wrangler login
npm run deploy
```

For GitHub Actions auto-deploy, add repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Then run Actions → **Deploy Basemap Open Gateway**.

## 4. Public endpoints after deployment

Assume the deployed gateway is:

`https://YOUR-GATEWAY.example`

Then publish:

| Purpose | Endpoint |
|---|---|
| Service index | `GET /` |
| Health | `GET /healthz` |
| PMTiles | `GET /basemap.pmtiles` |
| CDN alias | `GET /cdn/basemap.pmtiles` |
| XYZ raster | `GET /tiles/{z}/{x}/{y}.png` |
| Metadata API | `GET /api/v1/metadata` |
| Lon/lat → tile | `GET /api/v1/lonlat-to-tile?lon=106.7&lat=10.78&z=12` |
| TileJSON | `GET /tilejson.json` |
| OpenAPI | `GET /openapi.json` |
| Discovery | `GET /.well-known/basemap.json` |
| MCP for AI | `POST /mcp` |

## 5. Verify the deployed gateway

```bash
GATEWAY_URL=https://YOUR-GATEWAY.example \
PMTILES_URL=https://github.com/xulytiengviet/basemap/releases/latest/download/basemap.pmtiles \
  bash scripts/check_public_basemap.sh
```

Expected result:

```text
PMTiles header OK (v3).
Gateway core endpoints OK.
```

## 6. Consumer examples

### Leaflet / standard XYZ

```js
L.tileLayer('https://YOUR-GATEWAY.example/tiles/{z}/{x}/{y}.png', {
  minZoom: 3,
  maxZoom: 12,
  attribution: 'Basemap © Long Ngo'
}).addTo(map);
```

### MapLibre direct PMTiles

```js
const protocol = new pmtiles.Protocol({ metadata: true });
maplibregl.addProtocol('pmtiles', protocol.tile);

const source = {
  type: 'raster',
  url: 'pmtiles://https://github.com/xulytiengviet/basemap/releases/latest/download/basemap.pmtiles',
  tileSize: 256
};
```

### MCP / AI agents

Use the deployed Streamable HTTP endpoint:

`https://YOUR-GATEWAY.example/mcp`

Available tools:

- `get_basemap_metadata`
- `lonlat_to_tile`
- `get_tile_url`
- `get_service_endpoints`

## 7. Production recommendation

GitHub Release is suitable for the v1.0.0 public binary and testing. For sustained high-traffic map delivery, mirror `basemap.pmtiles` to object storage/CDN that supports HTTP Range and CORS, while keeping the same gateway/API contract.

## 8. Data rights

The repository source code is MIT licensed. The raster dataset must have its own verified source/license/attribution recorded in `DATA_ATTRIBUTION.md` before broad redistribution.
