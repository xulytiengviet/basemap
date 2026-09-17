# Long Ngo Basemap

**PMTiles-first WebGIS basemap · Open Gateway · MIT code**  
**Developer:** Long Ngo

This repository is organized around one canonical artifact: **`basemap.pmtiles`**. Build tools, validation, examples, CDN/API gateway and AI/MCP integrations all consume the same PMTiles archive.

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
| Repository release line | 1.1.0 |

Machine-readable details are in [`pmtiles/manifest.json`](pmtiles/manifest.json) and [`pmtiles/basemap.info.json`](pmtiles/basemap.info.json).

## Public asset

After the `v1.1.0` release is published, consumers should prefer the stable latest URL:

```text
https://github.com/xulytiengviet/basemap/releases/latest/download/basemap.pmtiles
```

Pinned release URL:

```text
https://github.com/xulytiengviet/basemap/releases/download/v1.1.0/basemap.pmtiles
```

The PMTiles binary is a **Release asset**, not a normal Git-tracked file. This keeps the Git history small and makes HTTP Range delivery practical.

## Repository layout

```text
basemap/
├── pmtiles/                 canonical metadata + checksums
├── tools/                   build, inspect, verify, release helpers
├── gateway/                 CDN / XYZ / REST / TileJSON / OpenAPI / MCP
├── examples/
│   ├── maplibre/            direct PMTiles example
│   └── leaflet/             XYZ-through-gateway example
├── docs/                    architecture, endpoints, release notes
├── .github/workflows/       build / verify / release / gateway deploy
├── DATA_ATTRIBUTION.md
├── CHANGELOG.md
└── LICENSE
```

## Use directly with MapLibre

```html
<script src="https://unpkg.com/maplibre-gl@5.13.0/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/pmtiles@4.5.0/dist/pmtiles.js"></script>
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
- Version-pinned release URLs are recommended for reproducible systems.

## License and attribution

Source code is **MIT License — Copyright (c) 2026 Long Ngo**.

The raster dataset is a separate work and does **not** automatically inherit the software MIT license. Its source, permission and required attribution must be documented in [`DATA_ATTRIBUTION.md`](DATA_ATTRIBUTION.md) before broad redistribution.
