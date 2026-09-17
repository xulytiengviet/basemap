const BOUNDS = [[-2.02106512, 91.93359375], [26.03704189, 126.03515625]];

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function landingHtml(base) {
  const b = esc(base);
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Long Ngo Basemap Open Gateway</title>
<style>
:root{font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;color:#15202b;background:#f5f7fa}*{box-sizing:border-box}body{margin:0}.wrap{max-width:1100px;margin:auto;padding:42px 22px}.hero{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:30px;box-shadow:0 8px 30px #0000000a}.tag{display:inline-block;padding:6px 10px;border-radius:999px;background:#eef6ff;color:#135ea8;font-weight:700;font-size:13px}h1{font-size:34px;margin:14px 0 8px}p{line-height:1.6;color:#475569}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px;margin-top:20px}.card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:18px}.card b{display:block;margin-bottom:8px}.url{font:13px ui-monospace,SFMono-Regular,Consolas,monospace;word-break:break-all;background:#f8fafc;padding:9px;border-radius:8px}a{color:#0b63ce;text-decoration:none}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.btn{display:inline-block;padding:10px 14px;border-radius:10px;background:#0b63ce;color:white;font-weight:700}.btn.alt{background:#172033}</style>
</head>
<body><div class="wrap"><section class="hero"><span class="tag">PMTiles v3 · API · CDN · MCP · WebGIS</span><h1>Long Ngo Basemap Open Gateway</h1><p>Gateway công khai cho raster PMTiles, XYZ PNG, TileJSON, REST/OpenAPI và MCP. Dữ liệu nguồn được phục vụ từ GitHub Release v1.1.0.</p><div class="actions"><a class="btn" href="/webgis">Mở WebGIS</a><a class="btn alt" href="/api/v1">Service JSON</a></div></section><div class="grid">
${[
['PMTiles CDN','/basemap.pmtiles'],['XYZ tiles','/tiles/{z}/{x}/{y}.png'],['TileJSON','/tilejson.json'],['Metadata API','/api/v1/metadata'],['OpenAPI','/openapi.json'],['MCP','/mcp'],['Health','/healthz'],['Discovery','/.well-known/basemap.json']
].map(([n,p])=>`<div class="card"><b>${n}</b><div class="url">${b}${p}</div>${p.includes('{')||p==='/mcp'?'' : `<p><a href="${p}">Mở endpoint →</a></p>`}</div>`).join('')}
</div><p>Developer: Long Ngo · Source code: MIT · Raster data rights are tracked separately.</p></div></body></html>`;
}

export function webgisHtml(base) {
  const b = esc(base);
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Long Ngo Basemap WebGIS</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIINfQ3yn0LZmRIFNefF6kCS0GfRrvv+QkM=" crossorigin="">
<style>html,body,#map{height:100%;margin:0}.panel{position:absolute;z-index:999;top:12px;right:12px;width:min(360px,calc(100% - 24px));background:#fff;border-radius:12px;padding:14px;box-shadow:0 8px 28px #0003;font:14px system-ui,Segoe UI,Arial}.panel h2{font-size:17px;margin:0 0 6px}.panel p{margin:6px 0;color:#475569;line-height:1.45}.row{display:flex;gap:8px;flex-wrap:wrap}.row a{background:#0b63ce;color:#fff;padding:7px 9px;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px}.status{font:12px ui-monospace,Consolas,monospace;background:#f1f5f9;padding:7px;border-radius:7px;margin-top:8px}</style></head>
<body><div id="map"></div><div class="panel"><h2>Long Ngo Basemap WebGIS</h2><p>Raster PMTiles v3 · zoom 3–12 · XYZ/Web Mercator</p><div class="row"><a href="/tilejson.json">TileJSON</a><a href="/api/v1/metadata">Metadata</a><a href="/openapi.json">OpenAPI</a><a href="/">Gateway</a></div><div id="status" class="status">Đang kiểm tra gateway…</div></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
const map=L.map('map',{minZoom:3,maxZoom:12,zoomControl:true});
L.tileLayer('/tiles/{z}/{x}/{y}.png',{minZoom:3,maxZoom:12,tileSize:256,attribution:'Basemap © Long Ngo'}).addTo(map);
map.fitBounds(${JSON.stringify(BOUNDS)});
fetch('/healthz').then(r=>r.json()).then(j=>document.getElementById('status').textContent='Gateway: '+(j.ok?'ONLINE':'ERROR')+' · '+location.host).catch(()=>document.getElementById('status').textContent='Gateway health check failed');
</script></body></html>`;
}
