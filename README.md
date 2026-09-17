# Long Ngo Basemap

**PMTiles-first WebGIS basemap · CDN SDK · Open Gateway · MIT code**  
**Developer:** Long Ngo

This repository is organized around one canonical artifact: **`basemap.pmtiles`**. Build tools, validation, CDN SDK, examples, API gateway and AI/MCP integrations all consume the same PMTiles archive.

## One-line CDN embed

The fastest integration path is a single jsDelivr script:

```html
<div id="map"></div>
<script
  src="https://cdn.jsdelivr.net/gh/xulytiengviet/basemap@v1.2.0/sdk/basemap.min.js"
  data-target="map"
  data-center="108.984375,12.0079884"
  data-zoom="5"
  data-height="520px">
</script>
```

The SDK automatically loads MapLibre GL JS + PMTiles, registers the `pmtiles://` protocol and reads the canonical raster archive directly from the GitHub Release asset.

JavaScript API:

```html
<div id="map" style="height:600px"></div>
<script src="https://cdn.jsdelivr.net/gh/xulytiengviet/basemap@v1.2.0/sdk/basemap.min.js"></script>
<script>
LongNgoBasemap.create({
  target: "map",
  center: [106.7, 10.8],
  zoom: 8,
  scale: true
});
</script>
```

ES module:

```js
import LongNgoBasemap from "https://cdn.jsdelivr.net/gh/xulytiengviet/basemap@v1.2.0/sdk/basemap.esm.js";
const map = await LongNgoBasemap.create({ target: "map", zoom: 6 });
```

See [`sdk/README.md`](sdk/README.md) and [`examples/embed/index.html`](examples/embed/index.html).

## Canonical basemap

| Property | Value |
|---|---|
| Format | PMTiles v3, raster PNG, XYZ/Web Mercator |
| Size | 117,829,388 bytes |
| Zoom | 3–12 |
| Addressed tiles | 171,237 |
| Unique tile contents | 24,123 |
| SHA-256 | `ff62a0549c722905ec30538fd4336bc93960e9a593c0eabe99600bc40ecbe77c` |
| Dataset version | 1.0.0 |
| Repository release line | 1.2.0 |

Machine-readable details are in [`pmtiles/manifest.json`](pmtiles/manifest.json) and [`pmtiles/basemap.info.json`](pmtiles/basemap.info.json).

## Public PMTiles asset

Moving URL:

```text
https://github.com/xulytiengviet/basemap/releases/latest/download/basemap.pmtiles
```

Pinned v1.2.0 URL:

```text
https://github.com/xulytiengviet/basemap/releases/download/v1.2.0/basemap.pmtiles
```

The PMTiles binary is a **Release asset**, not a normal Git-tracked file. Every release that becomes `latest` re-attaches the same verified binary unless the dataset itself changes.

## CDN URLs

```text
https://cdn.jsdelivr.net/gh/xulytiengviet/basemap@v1.2.0/sdk/basemap.min.js
https://cdn.jsdelivr.net/gh/xulytiengviet/basemap@v1.2.0/sdk/basemap.js
https://cdn.jsdelivr.net/gh/xulytiengviet/basemap@v1.2.0/sdk/basemap.esm.js
```

Use the version-pinned URL in production. `@main` is suitable only for development/testing.

## Repository layout

```text
basemap/
├── pmtiles/                 canonical metadata + checksums
├── sdk/                     one-line browser CDN SDK + ESM
├── tools/                   build, inspect, verify, release helpers
├── gateway/                 WebGIS / CDN / XYZ / REST / OpenAPI / MCP
├── examples/
│   ├── embed/               one-line CDN SDK example
│   ├── maplibre/            direct PMTiles example
│   └── leaflet/             XYZ-through-gateway example
├── docs/                    architecture, endpoints, release notes
├── .github/workflows/       build / verify / SDK / release / gateway deploy
├── DATA_ATTRIBUTION.md
├── CHANGELOG.md
└── LICENSE
```

## Use directly with MapLibre

```html
<script src="https://cdn.jsdelivr.net/npm/maplibre-gl@5.13.0/dist/maplibre-gl.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pmtiles@4.5.0/dist/pmtiles.js"></script>
<script>
const protocol = new pmtiles.Protocol({ metadata: true });
maplibregl.addProtocol("pmtiles", protocol.tile);

const map = new maplibregl.Map({
  container: "map",
  center: [108.984375, 12.0079884],
  zoom: 5,
  style: {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        url: "pmtiles://https://github.com/xulytiengviet/basemap/releases/latest/download/basemap.pmtiles",
        tileSize: 256
      }
    },
    layers: [{ id: "basemap", type: "raster", source: "basemap" }]
  }
});
</script>
```

## Build from source tiles

From an RAR containing `tiles/{z}/{x}/{y}.png`:

```bash
sudo apt-get install -y libarchive-tools libarchive-dev
python tools/build_from_rar.py input.rar dist/basemap.pmtiles
python tools/inspect.py dist/basemap.pmtiles
```

From an extracted XYZ directory:

```bash
python tools/build_from_xyz.py tiles dist/basemap.pmtiles
```

## Verify a public deployment

```bash
PMTILES_URL=https://github.com/xulytiengviet/basemap/releases/latest/download/basemap.pmtiles \
  bash tools/verify_public.sh
```

## Open Gateway

`gateway/` exposes the same basemap through:

```text
GET  /webgis
GET  /basemap.pmtiles
GET  /cdn/basemap.pmtiles
GET  /tiles/{z}/{x}/{y}.png
GET  /tilejson.json
GET  /api/v1/metadata
GET  /api/v1/lonlat-to-tile
GET  /openapi.json
GET  /.well-known/basemap.json
POST /mcp
```

See [`docs/PUBLIC_ENDPOINTS.md`](docs/PUBLIC_ENDPOINTS.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Release policy

- Git tracks **code + metadata**, not the 118 MB PMTiles binary.
- Every public binary release must match `pmtiles/manifest.json` SHA-256 and byte size.
- `latest/download/basemap.pmtiles` is the consumer-facing moving URL.
- Version-pinned release URLs and CDN SDK URLs are recommended for reproducible systems.

## License and attribution

Source code is **MIT License — Copyright (c) 2026 Long Ngo**.

The raster dataset is a separate work and does **not** automatically inherit the software MIT license. Its source, permission and required attribution must be documented in [`DATA_ATTRIBUTION.md`](DATA_ATTRIBUTION.md) before broad redistribution.
