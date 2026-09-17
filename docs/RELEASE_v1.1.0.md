# Release v1.1.0 — PMTiles-first repository

**Developer:** Long Ngo  
**Code license:** MIT  
**Dataset payload version:** 1.0.0

## What changed

This release professionally restructures the repository around the canonical `basemap.pmtiles` artifact while keeping the validated PMTiles payload byte-identical to the previous build.

### Canonical artifact

- File: `basemap.pmtiles`
- Size: 117,829,388 bytes
- SHA-256: `ff62a0549c722905ec30538fd4336bc93960e9a593c0eabe99600bc40ecbe77c`
- PMTiles: v3, clustered
- Raster: PNG, XYZ/Web Mercator
- Zoom: 3–12
- Addressed tiles: 171,237
- Unique tile contents: 24,123

### Repository improvements

- `pmtiles/` now owns canonical metadata and checksums.
- `tools/` owns build, inspection, verification and release tooling.
- `examples/` separates consumer examples from production code.
- `docs/` contains architecture, public endpoints and archived release procedures.
- `gateway/` remains the delivery façade for PMTiles/CDN/XYZ/REST/OpenAPI/MCP.

## Release assets

A complete release should contain:

1. `basemap.pmtiles`
2. `basemap.info.json`
3. `basemap.pmtiles.sha256`

The binary must match the byte size and SHA-256 declared in `pmtiles/manifest.json` before publication.

## Stable consumer URL

```text
https://github.com/xulytiengviet/basemap/releases/latest/download/basemap.pmtiles
```

For reproducible deployments, pin:

```text
https://github.com/xulytiengviet/basemap/releases/download/v1.1.0/basemap.pmtiles
```

## Data rights

MIT applies to the repository source code. Raster content rights are tracked separately in `DATA_ATTRIBUTION.md`.
