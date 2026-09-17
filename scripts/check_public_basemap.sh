#!/usr/bin/env bash
set -euo pipefail

PMTILES_URL="${PMTILES_URL:-https://github.com/xulytiengviet/basemap/releases/latest/download/basemap.pmtiles}"
GATEWAY_URL="${GATEWAY_URL:-}"

printf 'Checking PMTiles: %s\n' "$PMTILES_URL"

headers="$(mktemp)"
chunk="$(mktemp)"
trap 'rm -f "$headers" "$chunk"' EXIT

curl -fsSLI "$PMTILES_URL" > "$headers"
status="$(awk 'toupper($1) ~ /^HTTP\// {code=$2} END{print code}' "$headers")"
printf 'HEAD final status: %s\n' "$status"

curl -fsSL -D "$headers" -H 'Range: bytes=0-126' "$PMTILES_URL" -o "$chunk"
range_status="$(awk 'toupper($1) ~ /^HTTP\// {code=$2} END{print code}' "$headers")"
printf 'Range status: %s\n' "$range_status"

magic="$(head -c 7 "$chunk")"
if [ "$magic" != "PMTiles" ]; then
  echo "ERROR: PMTiles magic not found; got: $magic" >&2
  exit 1
fi

version="$(od -An -t u1 -j 7 -N 1 "$chunk" | tr -d ' ')"
if [ "$version" != "3" ]; then
  echo "ERROR: Expected PMTiles v3, got version byte: $version" >&2
  exit 1
fi

echo 'PMTiles header OK (v3).'

if [ -n "$GATEWAY_URL" ]; then
  base="${GATEWAY_URL%/}"
  echo "Checking gateway: $base"
  curl -fsSL "$base/healthz" >/dev/null
  curl -fsSL "$base/api/v1/metadata" >/dev/null
  curl -fsSL "$base/tilejson.json" >/dev/null
  curl -fsSL "$base/.well-known/basemap.json" >/dev/null
  echo 'Gateway core endpoints OK.'
fi
