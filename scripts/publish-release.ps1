param(
  [string]$Tag = "v1.0.0",
  [string]$Dist = "dist"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) is not installed. Install from https://cli.github.com/ and run: gh auth login"
}

$files = @(
  (Join-Path $Dist "basemap.pmtiles"),
  (Join-Path $Dist "basemap.info.json"),
  (Join-Path $Dist "basemap.pmtiles.sha256")
)

foreach ($file in $files) {
  if (-not (Test-Path $file)) { throw "Missing file: $file" }
}

Write-Host "Checking GitHub authentication..."
gh auth status

Write-Host "Uploading assets to release $Tag..."
gh release upload $Tag @files --repo xulytiengviet/basemap --clobber

Write-Host "Verifying release assets..."
gh release view $Tag --repo xulytiengviet/basemap --json tagName,assets,url

Write-Host "Public PMTiles URL:"
Write-Host "https://github.com/xulytiengviet/basemap/releases/latest/download/basemap.pmtiles"
