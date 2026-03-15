#!/usr/bin/env bash
# =============================================================================
# build-desktop.sh
#
# Full build pipeline for the Retiree Plan desktop app.
# Run from anywhere – paths are resolved relative to the script location.
#
# Steps
#   1. Build workspace packages (finance-engine, api, web)
#   2. Bundle the NestJS API with @vercel/ncc into resources/server/
#   3. Install + rebuild native modules (bcrypt, @prisma/client) for Electron
#   4. Copy the React static build into resources/web/
#   5. Stamp a template SQLite DB (schema only, no user data) into resources/
#   6. Compile the Electron TypeScript (main/preload)
#   7. Generate placeholder app icon if build-resources/icon.png is missing
#   8. Run electron-builder for the current platform
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$DESKTOP_DIR/../.." && pwd)"
RESOURCES_DIR="$DESKTOP_DIR/resources"
PRISMA_SCHEMA="$ROOT_DIR/prisma/schema.prisma"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Retiree Plan – Desktop Build Pipeline   ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Root  : $ROOT_DIR"
echo "  Output: $DESKTOP_DIR/release"
echo ""

# ── 1. Build workspace packages ────────────────────────────────────────────────
echo "▸ [1/7] Building workspace packages..."
cd "$ROOT_DIR"

npm run build --workspaces --if-present

# ── 2. Bundle API with ncc ─────────────────────────────────────────────────────
# Bundle everything EXCEPT native modules so they can be rebuilt for Electron's
# specific Node ABI in the next step.
echo "▸ [2/7] Bundling NestJS API with ncc..."
cd "$ROOT_DIR"

rm -rf "$RESOURCES_DIR/server"
mkdir -p "$RESOURCES_DIR/server"

npx --yes @vercel/ncc build \
  "$ROOT_DIR/apps/api/dist/main.js" \
  --out "$RESOURCES_DIR/server" \
  --external bcrypt \
  --external @prisma/client \
  --external @github/copilot-sdk \
  -m

# ── 3. Install & rebuild native modules for Electron ──────────────────────────
# Place a minimal package.json so npm install + electron-rebuild work correctly.
echo "▸ [3/7] Installing and rebuilding native modules for Electron..."

API_BCRYPT_VER=$(node -e "process.stdout.write(require('$ROOT_DIR/apps/api/package.json').dependencies.bcrypt ?? '5')")
PRISMA_VER=$(node -e "process.stdout.write(require('$ROOT_DIR/apps/api/package.json').dependencies['@prisma/client'] ?? '6')")
COPILOT_VER=$(node -e "process.stdout.write(require('$ROOT_DIR/apps/api/package.json').dependencies['@github/copilot-sdk'] ?? '')")

# Determine Electron version. Prefer the workspace-local install, fall back
# to the repository root install. If neither exists, print guidance.
if [ -f "$DESKTOP_DIR/node_modules/electron/package.json" ]; then
  ELECTRON_VER=$(node -e "process.stdout.write(require('$DESKTOP_DIR/node_modules/electron/package.json').version)")
elif [ -f "$ROOT_DIR/node_modules/electron/package.json" ]; then
  ELECTRON_VER=$(node -e "process.stdout.write(require('$ROOT_DIR/node_modules/electron/package.json').version)")
else
  echo "Electron package not found in apps/desktop or repo root. Install with:"
  echo "  npm ci --workspace apps/desktop"
  echo "or from the root: npm ci"
  exit 1
fi

# Write a lean package.json for the server bundle
# Only include copilot-sdk if the version string is non-empty
COPILOT_DEP=''
if [ -n "${COPILOT_VER}" ]; then
  COPILOT_DEP=",\"@github/copilot-sdk\": \"${COPILOT_VER}\""
fi

cat > "$RESOURCES_DIR/server/package.json" << EOF
{
  "name": "retiree-plan-server",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "bcrypt": "$API_BCRYPT_VER",
    "@prisma/client": "$PRISMA_VER"
    ${COPILOT_DEP}
  }
}
EOF

# Install native deps into the server subfolder
npm install --prefix "$RESOURCES_DIR/server" --production --no-package-lock

# Regenerate the Prisma client for the current OS/arch targeting the native engine
DATABASE_URL="file:${TMPDIR:-/tmp}/retiree-plan-build-dummy.db" \
  npx prisma generate --schema="$PRISMA_SCHEMA"

# Copy the generated Prisma client (.prisma/client/) into the server node_modules
if [ -d "$ROOT_DIR/node_modules/.prisma" ]; then
  cp -r "$ROOT_DIR/node_modules/.prisma" "$RESOURCES_DIR/server/node_modules/.prisma"
fi
if [ -d "$ROOT_DIR/node_modules/@prisma/client" ]; then
  cp -r "$ROOT_DIR/node_modules/@prisma/client" "$RESOURCES_DIR/server/node_modules/@prisma/client"
fi

# Rebuild ALL native modules in resources/server for Electron's Node ABI
cd "$DESKTOP_DIR"
npx @electron/rebuild \
  --version "$ELECTRON_VER" \
  --module-dir "$RESOURCES_DIR/server"
cd "$ROOT_DIR"

# ── 4. Copy web build ──────────────────────────────────────────────────────────
echo "▸ [4/7] Copying React build..."
rm -rf "$RESOURCES_DIR/web"
cp -r "$ROOT_DIR/apps/web/dist" "$RESOURCES_DIR/web"

# ── 5. Generate template database ─────────────────────────────────────────────
# Push the Prisma schema to a fresh SQLite file that will be shipped with the
# app and copied to userData on the end-user's first launch.
echo "▸ [5/7] Creating template database..."
TEMPLATE_DB="$RESOURCES_DIR/template.db"
rm -f "$TEMPLATE_DB"

DATABASE_URL="file:$TEMPLATE_DB" \
  npx prisma db push \
    --schema="$PRISMA_SCHEMA" \
    --accept-data-loss \
    --skip-generate

echo "  Template DB: $TEMPLATE_DB"

# ── 6. Compile Electron TypeScript ────────────────────────────────────────────
echo "▸ [6/8] Compiling Electron main process..."
cd "$DESKTOP_DIR"
npm run build

echo "▸ [7/8] Generating app icon..."
node "$SCRIPT_DIR/generate-icon.js"

echo "▸ [8/8] Packaging with electron-builder..."
npx electron-builder --publish never

echo ""
echo "✅ Done!  Artifacts → $DESKTOP_DIR/release/"
echo ""
