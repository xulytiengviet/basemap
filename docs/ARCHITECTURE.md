# Architecture

## Design goal

`basemap.pmtiles` is the immutable data plane. Everything else is a build, validation, delivery or integration layer around that one artifact.

```text
XYZ PNG tiles / source archive
            │
            ▼
         tools/
 build + inspect + verify
            │
            ▼
      basemap.pmtiles
            │
     ┌──────┴──────────────┐
     │                     │
     ▼                     ▼
GitHub Release        Object storage/CDN
HTTP Range                 mirror
     │                     │
     └──────────┬──────────┘
                ▼
             gateway/
      Cloudflare Worker façade
                │
    ┌───────────┼───────────────┐
    ▼           ▼               ▼
 PMTiles       XYZ             REST
 Range         PNG        TileJSON/OpenAPI
    │           │               │
    └───────────┴───────┬───────┘
                        ▼
                       MCP
                        │
                 AI / GeoAI agents
```

## Layers

### 1. Data plane — `pmtiles/`

`pmtiles/manifest.json` is the release contract. It contains the expected file name, byte size, SHA-256, bounds, zoom range and public release URLs.

### 2. Tooling — `tools/`

Build scripts create a PMTiles v3 archive from RAR or extracted XYZ tiles. Inspection and public verification tools validate the artifact before and after publication.

### 3. Delivery — GitHub Release / CDN

The 118 MB binary is not stored in normal Git history. The canonical download is a GitHub Release asset; high-traffic deployments should mirror the same byte-identical file to object storage that supports HTTP Range and CORS.

### 4. Gateway — `gateway/`

The Cloudflare Worker exposes the PMTiles archive through direct Range/CDN access, raster XYZ, metadata REST endpoints, TileJSON, OpenAPI and MCP.

### 5. Examples — `examples/`

MapLibre demonstrates direct PMTiles consumption. Leaflet demonstrates compatibility through the XYZ gateway endpoint.

## Versioning

- **Dataset version** changes only when the PMTiles payload/data changes.
- **Repository release version** may change for code, gateway, docs, build or operational improvements while retaining the same dataset bytes.
- A release must never silently replace a PMTiles binary with different bytes under the same version-pinned URL.
