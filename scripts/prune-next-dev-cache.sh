#!/usr/bin/env bash
# Drop Next.js caches that have grown large enough to peg CPU when all portals start.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MAX_MB="${NEXT_DEV_CACHE_MAX_MB:-1536}"

for app in admin investor issuer landing; do
  cache="$ROOT/apps/$app/.next"
  if [[ ! -d "$cache" ]]; then
    continue
  fi

  size_mb="$(du -sm "$cache" | awk '{print $1}')"
  if [[ "$size_mb" -gt "$MAX_MB" ]]; then
    echo "Pruning apps/$app/.next (${size_mb}MB > ${MAX_MB}MB)"
    rm -rf "$cache"
  fi
done
