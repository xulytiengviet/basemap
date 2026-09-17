# Long Ngo Basemap Open Gateway

Gateway công khai cho `basemap.pmtiles`, phát triển bởi **Long Ngo**, mã nguồn **MIT**.

Một deployment mở đồng thời các cổng:

- PMTiles/CDN Range: `/basemap.pmtiles`
- REST metadata: `/api/v1/metadata`
- TileJSON: `/tilejson.json`
- XYZ PNG: `/tiles/{z}/{x}/{y}.png`
- tọa độ WGS84 → XYZ: `/api/v1/lonlat-to-tile?lon=106.7&lat=10.8&z=10`
- OpenAPI: `/openapi.json`
- MCP cho AI/agent: `POST /mcp`
- health: `/healthz`
- service discovery: `/.well-known/basemap.json`

## Chạy local

```bash
cd gateway
npm install
npm run dev
```

Mặc định: `http://127.0.0.1:8787`.

## Deploy Cloudflare Workers

```bash
cd gateway
npm install
npx wrangler login
npm run deploy
```

Production dùng HTTPS 443 qua hostname Worker/custom domain.

`PMTILES_URL` mặc định trỏ tới GitHub Release `basemap.pmtiles`. Với tải lớn, nên đổi biến này sang Cloudflare R2/S3/object storage hỗ trợ byte Range và CORS.

## MCP

Remote MCP endpoint:

```text
https://YOUR-GATEWAY/mcp
```

Các tool:

- `get_basemap_metadata`
- `lonlat_to_tile`
- `get_tile_url`
- `get_service_endpoints`

MCP dùng Streamable HTTP/JSON. `MCP_ALLOWED_ORIGINS` là danh sách origin trình duyệt được phép POST, phân tách bằng dấu phẩy. Client server-to-server thường không gửi `Origin`.

## Cấu hình

Biến trong `wrangler.toml`:

```toml
PMTILES_URL = "https://.../basemap.pmtiles"
SERVICE_NAME = "Long Ngo Basemap Open Gateway"
AUTHOR = "Long Ngo"
LICENSE = "MIT"
MCP_ALLOWED_ORIGINS = "https://chatgpt.com,https://claude.ai"
```

## Giấy phép

Code gateway: MIT — Copyright (c) 2026 Long Ngo.

Giấy phép code không tự động thay thế giấy phép/attribution của dữ liệu raster nguồn; xem `../DATA_ATTRIBUTION.md`.
