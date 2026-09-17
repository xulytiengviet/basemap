# Changelog

All notable repository and release changes are documented here.

## [1.1.0] - 2026-09-17

### Repository structure
- Reorganized the project around the canonical `basemap.pmtiles` artifact.
- Added `pmtiles/manifest.json` as the machine-readable release contract.
- Moved build/inspection/verification utilities from `scripts/` to `tools/`.
- Moved WebGIS examples under `examples/`.
- Moved public endpoint documentation under `docs/`.
- Preserved the existing Cloudflare Worker gateway and MCP/OpenAPI interfaces.

### Release engineering
- Standardized the canonical PMTiles size and SHA-256 validation.
- Added a release-from-URL workflow for publishing large PMTiles assets without committing them to Git.
- Added a Windows one-command release helper targeting `v1.1.0`.

### Dataset
- The PMTiles payload is byte-identical to the previously validated dataset version 1.0.0.
- SHA-256: `ff62a0549c722905ec30538fd4336bc93960e9a593c0eabe99600bc40ecbe77c`.

## [1.0.0] - 2026-09-17

- Initial PMTiles v3 build from supplied XYZ raster tiles.
- Added MapLibre example, build scripts, public gateway, REST/XYZ/TileJSON/OpenAPI/MCP endpoints and deployment workflows.
