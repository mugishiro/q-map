#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../backend"

# 1) Install deps for build (dev deps included for TypeScript)
npm ci

# 2) TypeScript -> dist
npm run build

# 3) Create deployable bundle with only runtime deps
rm -rf dist_bundle
mkdir -p dist_bundle
cp -a dist/* dist_bundle/
cp package.json package-lock.json dist_bundle/
npm ci --omit=dev --ignore-scripts --no-progress --prefix dist_bundle
