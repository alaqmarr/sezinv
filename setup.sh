#!/usr/bin/env bash
# ==============================================================================
# SEZSEC Jamaat Events & Store Portal — Automated Setup & Build Script
# ==============================================================================
# Usage:
#   chmod +x setup.sh
#   ./setup.sh
#
# Performs:
#   1. Node.js (>= 20) & npm pre-flight verification
#   2. Environment (.env) provisioning & secret generation (if missing)
#   3. Dependency installation (npm ci / npm install)
#   4. Database directory sanctioning, Prisma client generation, schema push,
#      SQLite WAL / FK pragma enforcement, integrity check & file permissions
#   5. Next.js route type generation & strict TypeScript verification (tsc)
#   6. Production build (next build)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "======================================================================"
echo "  SEZSEC Jamaat Events & Store Portal — Setup & Build"
echo "  Working directory: $SCRIPT_DIR"
echo "======================================================================"

# ------------------------------------------------------------------------------
# 1. Pre-flight Runtime Checks
# ------------------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is not installed. Please install Node.js v20 or newer." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] npm is not installed. Please install npm along with Node.js." >&2
  exit 1
fi

NODE_VERSION="$(node -v)"
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
NPM_VERSION="$(npm -v)"

if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "[ERROR] Node.js v20+ is required (detected $NODE_VERSION)." >&2
  exit 1
fi

echo "[1/6] Runtime verified: Node.js $NODE_VERSION, npm v$NPM_VERSION"

# ------------------------------------------------------------------------------
# 2. Environment (.env) Provisioning & Sanctioning
# ------------------------------------------------------------------------------
if [ ! -f ".env" ]; then
  echo "[2/6] Creating .env from template with generated cryptographic secrets..."
  if [ -f ".env.example" ]; then
    cp ".env.example" ".env"
  else
    cat > ".env" <<'EOF'
DATABASE_URL="file:./data/jamatevents.db"
NEON_DATABASE_URL=""
AUTH_SECRET="replace-with-strong-random-secret"
AMOUNT_OTP_SECRET="replace-with-strong-random-secret"
SEZSEC_BRIDGE_KEY="replace-with-strong-shared-bridge-key"
SMTP_EMAIL="info@sezsec.org"
SMTP_PASSWORD=""
NEXT_PUBLIC_APP_URL="http://localhost:3000"
EOF
  fi

  node <<'NODE_EOF'
const fs = require("node:fs");
const crypto = require("node:crypto");

let envText = fs.readFileSync(".env", "utf8");
const replacePlaceholder = (key, placeholder) => {
  const secret = crypto.randomBytes(32).toString("hex");
  const pattern = new RegExp(`^(${key}=)"?${placeholder}"?`, "m");
  if (pattern.test(envText)) {
    envText = envText.replace(pattern, `$1"${secret}"`);
  }
};

replacePlaceholder("AUTH_SECRET", "replace-with-strong-random-secret");
replacePlaceholder("AMOUNT_OTP_SECRET", "replace-with-strong-random-secret");
replacePlaceholder("SEZSEC_BRIDGE_KEY", "replace-with-strong-shared-bridge-key");

fs.writeFileSync(".env", envText, { mode: 0o600 });
NODE_EOF
  chmod 600 ".env" 2>/dev/null || true
  echo "      Created and secured .env (mode 600)."
else
  chmod 600 ".env" 2>/dev/null || true
  echo "[2/6] Existing .env found — preserving configuration."
fi

# ------------------------------------------------------------------------------
# 3. Install Dependencies
# ------------------------------------------------------------------------------
echo "[3/6] Installing project dependencies..."
if [ "${1:-}" = "--ci" ] || [ ! -d "node_modules" ]; then
  if [ -f "package-lock.json" ]; then
    npm ci --no-audit --no-fund || npm install --no-audit --no-fund
  else
    npm install --no-audit --no-fund
  fi
else
  npm install --no-audit --no-fund
fi

# ------------------------------------------------------------------------------
# 4. Sanction Database Directory, Setup Schema & Enforce SQLite WAL Pragmas
# ------------------------------------------------------------------------------
echo "[4/6] Sanctioning SQLite database and applying Prisma schema..."

DB_FILE_PATH="$(node <<'NODE_EOF'
require("dotenv/config");
const path = require("node:path");
const rawUrl = (process.env.DATABASE_URL || "file:./data/jamatevents.db").trim();
if (rawUrl === ":memory:") {
  process.stdout.write(":memory:");
} else {
  const stripped = rawUrl.replace(/^file:/, "");
  const resolved = path.isAbsolute(stripped)
    ? stripped
    : path.resolve(process.cwd(), stripped);
  process.stdout.write(resolved);
}
NODE_EOF
)"

if [ "$DB_FILE_PATH" != ":memory:" ]; then
  DB_DIR="$(dirname "$DB_FILE_PATH")"
  mkdir -p "$DB_DIR"
  chmod 700 "$DB_DIR" 2>/dev/null || true
  echo "      Sanctioned database directory: $DB_DIR"
fi

echo "      Generating Prisma client..."
npx prisma generate

echo "      Applying database schema (non-destructive)..."
npx prisma db push

echo "      Enforcing SQLite WAL mode, relational constraints & health check..."
npx tsx prisma/sanction-db.ts

if [ "$DB_FILE_PATH" != ":memory:" ]; then
  for f in "$DB_FILE_PATH" "${DB_FILE_PATH}-wal" "${DB_FILE_PATH}-shm"; do
    if [ -f "$f" ]; then
      chmod 600 "$f" 2>/dev/null || true
    fi
  done
fi

# ------------------------------------------------------------------------------
# 5. TypeScript Verification (Next.js Route Typegen + tsc --noEmit)
# ------------------------------------------------------------------------------
echo "[5/6] Running Next.js route type generation & TypeScript check..."
npx next typegen
npx tsc --noEmit
echo "      TypeScript check passed with 0 errors."

# ------------------------------------------------------------------------------
# 6. Production Build
# ------------------------------------------------------------------------------
echo "[6/6] Running optimized Next.js production build..."
npm run build

echo "======================================================================"
echo "  Setup & Build Completed Successfully!"
echo "  Start production server : npm run start"
echo "  Start development server: npm run dev"
echo "======================================================================"
