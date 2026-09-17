# Public API / CDN / MCP endpoints

Phát triển: **Long Ngo** · Software license: **MIT**

Giả sử gateway được deploy tại `https://map.example.org`:

| Cổng | Endpoint | Mục đích |
|---|---|---|
| HTTPS 443 | `/basemap.pmtiles` | PMTiles v3 qua HTTP Range/CDN |
| HTTPS 443 | `/cdn/basemap.pmtiles` | alias CDN |
| HTTPS 443 | `/tiles/{z}/{x}/{y}.png` | XYZ raster PNG cho Leaflet/MapLibre/OpenLayers |
| HTTPS 443 | `/tilejson.json` | TileJSON discovery |
| HTTPS 443 | `/api/v1/metadata` | header + metadata + endpoints |
| HTTPS 443 | `/api/v1/lonlat-to-tile` | WGS84 → XYZ |
| HTTPS 443 | `/openapi.json` | OpenAPI 3.1 machine-readable |
| HTTPS 443 | `POST /mcp` | MCP Streamable HTTP cho AI agent |
| HTTPS 443 | `/.well-known/basemap.json` | service discovery |
| HTTPS 443 | `/healthz` | health check |
| local 8787 | tất cả endpoint trên | `wrangler dev --port 8787` |

## Ví dụ

```bash
curl https://map.example.org/healthz
curl https://map.example.org/api/v1/metadata
curl "https://map.example.org/api/v1/lonlat-to-tile?lon=106.7&lat=10.8&z=10"
curl -o tile.png https://map.example.org/tiles/10/815/481.png
curl -H "Range: bytes=0-16383" https://map.example.org/basemap.pmtiles -o header.bin
```

Leaflet:

```js
L.tileLayer('https://map.example.org/tiles/{z}/{x}/{y}.png', {
  minZoom: 3,
  maxZoom: 12,
  attribution: 'Basemap gateway developed by Long Ngo'
}).addTo(map);
```

MapLibre raster source:

```js
map.addSource('longngo-basemap', {
  type: 'raster',
  tiles: ['https://map.example.org/tiles/{z}/{x}/{y}.png'],
  tileSize: 256,
  minzoom: 3,
  maxzoom: 12
});
```

PMTiles trực tiếp:

```text
pmtiles://https://map.example.org/basemap.pmtiles
```

## Chính sách mở

REST/XYZ/CDN được bật CORS `*` để website công khai có thể khai thác. MCP có kiểm tra `Origin` riêng; cập nhật `MCP_ALLOWED_ORIGINS` khi muốn cho thêm ứng dụng web AI truy cập.
