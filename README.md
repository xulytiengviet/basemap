# basemap — XYZ raster → `basemap.pmtiles`

Repo này đóng gói cây tile raster chuẩn `z/x/y` thành **một file PMTiles v3** để dùng lâu dài cho WebGIS mà không cần tile server riêng.

## Bộ dữ liệu đã kiểm tra

Archive đầu vào được cung cấp có **171.237 PNG tiles**, chuẩn **XYZ / Web Mercator**, zoom **3–12**. Phạm vi chi tiết ở z12 xấp xỉ:

`91.93359375,-2.02106512,126.03515625,26.03704189`

Bản build kiểm thử tạo `basemap.pmtiles` khoảng **117,8 MB**, `clustered=true`; 171.237 địa chỉ tile được deduplicate còn 24.123 nội dung PNG duy nhất.

> `basemap.pmtiles` lớn hơn giới hạn file Git thông thường 100 MB, vì vậy không commit trực tiếp vào nhánh chính. Hãy dùng GitHub Release asset, Cloudflare R2/S3 hoặc static object storage có HTTP Range + CORS.

## Build trực tiếp từ RAR

Linux/Ubuntu cần `libarchive`:

```bash
sudo apt-get install libarchive-tools
python scripts/build_pmtiles_from_rar.py input.rar dist/basemap.pmtiles \
  --name "Vietnam & Southeast Asia Raster Basemap"
python scripts/inspect_pmtiles.py dist/basemap.pmtiles
sha256sum dist/basemap.pmtiles
```

Script đọc RAR theo stream và **không bung 171 nghìn file ra đĩa**. Tile được stage vào SQLite tạm, sắp theo PMTiles tile-id/Hilbert order, deduplicate SHA-256 rồi đóng gói clustered PMTiles.

## Build từ thư mục XYZ đã giải nén

```bash
python scripts/build_pmtiles_from_xyz.py tiles dist/basemap.pmtiles
```

Cấu trúc:

```text
tiles/
  3/6/3.png
  ...
  12/3240/1870.png
```

## GitHub Actions

Vào **Actions → Build basemap.pmtiles → Run workflow**. Có thể nhập `source_url` trỏ trực tiếp tới file RAR. Workflow luôn tạo artifact; bật `publish_release=true` để đưa `basemap.pmtiles` vào GitHub Release.

## MapLibre GL JS

```html
<script src="https://unpkg.com/maplibre-gl@5.13.0/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/pmtiles@4.5.0/dist/pmtiles.js"></script>
<script>
const protocol = new pmtiles.Protocol({metadata:true});
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
        url: "pmtiles://https://YOUR-HOST/basemap.pmtiles",
        tileSize: 256
      }
    },
    layers: [{ id: "basemap", type: "raster", source: "basemap" }]
  }
});
</script>
```

Mở `web/index.html` để dùng demo; có thể truyền URL qua `?pmtiles=https://.../basemap.pmtiles`.

## Kiến trúc khuyến nghị

```text
RAR / tiles z/x/y
      │
      ▼
build_pmtiles_from_rar.py
      │  sort + dedup + clustered PMTiles v3
      ▼
 basemap.pmtiles
      │
      ├── GitHub Release (nhỏ/gọn, demo)
      ├── Cloudflare R2 / S3 (khuyến nghị production)
      └── static server hỗ trợ HTTP Range + CORS
                │
                ▼
          MapLibre / Leaflet / OpenLayers
```

PMTiles cho phép ứng dụng đọc trực tiếp một archive trên static/object storage bằng byte-range, không cần backend tile riêng.

## Quyền dữ liệu

Mã nguồn repo dùng MIT. **Dữ liệu raster không mặc nhiên mang MIT**. Archive đầu vào không kèm metadata/license, vì vậy trước khi public `basemap.pmtiles` cần điền nguồn, giấy phép và attribution trong [`DATA_ATTRIBUTION.md`](DATA_ATTRIBUTION.md).
