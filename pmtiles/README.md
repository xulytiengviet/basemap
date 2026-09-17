# Canonical PMTiles artifact

This directory describes the **single canonical basemap binary** used by the repository.

The binary itself is intentionally not committed to Git because it is 117,829,388 bytes. It is distributed as a GitHub Release asset named exactly:

```text
basemap.pmtiles
```

## Canonical identity

- PMTiles version: 3
- Raster format: PNG
- Scheme: XYZ / Web Mercator
- Zoom: 3–12
- Size: 117,829,388 bytes
- SHA-256: `ff62a0549c722905ec30538fd4336bc93960e9a593c0eabe99600bc40ecbe77c`
- Addressed tile count: 171,237
- Tile entries: 30,925
- Unique tile contents: 24,123

Use `manifest.json` for machine-readable release metadata and `basemap.info.json` for the parsed PMTiles header/metadata snapshot.

## Consumer rule

Applications should use the GitHub Release asset or a mirrored object-storage/CDN copy. Do not reconstruct URLs from repository paths and do not expect `basemap.pmtiles` to exist in the Git tree.
