param(
  [string]$Tag = "v1.1.0",
  [string]$Dist = "dist"
)

$ErrorActionPreference = "Stop"
$repo = "xulytiengviet/basemap"
$pmtiles = Join-Path $Dist "basemap.pmtiles"
$info = Join-Path $Dist "basemap.info.json"
$sha = Join-Path $Dist "basemap.pmtiles.sha256"

foreach ($file in @($pmtiles, $info, $sha)) {
  if (-not (Test-Path $file)) { throw "Missing release asset: $file" }
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "GitHub CLI (gh) is required." }
gh auth status

$expected = "ff62a0549c722905ec30538fd4336bc93960e9a593c0eabe99600bc40ecbe77c"
$actual = (Get-FileHash -Algorithm SHA256 $pmtiles).Hash.ToLower()
if ($actual -ne $expected) { throw "SHA-256 mismatch: $actual" }
if ((Get-Item $pmtiles).Length -ne 117829388) { throw "Unexpected basemap.pmtiles size." }

$exists = $true
try { gh release view $Tag --repo $repo | Out-Null } catch { $exists = $false }
if (-not $exists) {
  gh release create $Tag --repo $repo --title "$Tag — Long Ngo Basemap" --notes-file "docs/RELEASE_v1.1.0.md"
}

gh release upload $Tag $pmtiles $info $sha --repo $repo --clobber

gh release view $Tag --repo $repo
Write-Host "Published: https://github.com/$repo/releases/download/$Tag/basemap.pmtiles"
