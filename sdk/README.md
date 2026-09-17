# Long Ngo Basemap SDK

A browser SDK for embedding the canonical raster `basemap.pmtiles` with one `<script>` tag.

## One-line embed

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

`basemap.min.js` is served/minified by jsDelivr from `sdk/basemap.js`.

## JavaScript API

```html
<div id="map" style="height: 600px"></div>
<script src="https://cdn.jsdelivr.net/gh/xulytiengviet/basemap@v1.2.0/sdk/basemap.min.js"></script>
<script>
LongNgoBasemap.create({
  target: "map",
  center: [106.7, 10.8],
  zoom: 8,
  navigation: true,
  scale: true
});
</script>
```

Global API:

- `LongNgoBasemap.create(options)`
- `LongNgoBasemap.addTo(options)`
- `LongNgoBasemap.getMetadata([archiveUrl])`
- `LongNgoBasemap.ready()`
- `LongNgoBasemap.version`
- `LongNgoBasemap.archive`
- `LongNgoBasemap.bounds`
- `LongNgoBasemap.center`

## Data attributes

Supported on the `<script>` tag:

- `data-target="map"`
- `data-center="lon,lat"`
- `data-zoom="5"`
- `data-height="480px"`
- `data-archive="https://.../custom.pmtiles"`
- `data-navigation="false"`
- `data-scale="true"`
- `data-fit-bounds="true"`
- `data-hash="true"`

## ESM

```html
<div id="map" style="height: 600px"></div>
<script type="module">
  import LongNgoBasemap from "https://cdn.jsdelivr.net/gh/xulytiengviet/basemap@v1.2.0/sdk/basemap.esm.js";
  const map = await LongNgoBasemap.create({ target: "map", zoom: 6 });
</script>
```

## Dependencies

The browser loader dynamically loads pinned versions of:

- MapLibre GL JS `5.13.0`
- PMTiles JS `4.5.0`

The map data itself remains the GitHub Release PMTiles asset:

```text
https://github.com/xulytiengviet/basemap/releases/latest/download/basemap.pmtiles
```

Source code is MIT licensed. Raster data rights remain governed separately by `DATA_ATTRIBUTION.md`.
