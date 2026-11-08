#!/usr/bin/env bash
# ==============================================================================
# SEZSEC Jamaat Events & Store Portal (sezinv) — Production Update Script
# ==============================================================================
# Target Environment : Oracle Ubuntu Server
# PM2 Instance Name  : sezinv (override with PM2_APP_NAME)
# Application Port   : 3333   (override with APP_PORT)
#
# Usage:
#   ./update.sh
#   bash update.sh
#
# Performs:
#   1. Runtime & tool verification (git, node >= 20, npm, pm2)
#   2. Hot pre-update SQLite backup into data/backups/ (retains latest 10)
#   3. Clean GitHub sync (fetches & resets tracked files to origin/<branch>
#      while preserving untracked .env and data/* SQLite database files)
#   4. Dependency installation (npm install)
#   5. Prisma client generation, non-destructive schema push & DB sanctioning
#      (WAL mode, foreign keys, default modules including event_charges)
#   6. Next.js route typegen, TypeScript check (tsc --noEmit) & production build
#   7. PM2 reload/restart (or initial start) of `sezinv` on port 3333 + pm2 save
#   8. Local HTTP readiness verification on http://127.0.0.1:3333/login
# ==============================================================================

set -euo pipefail

main() {
  local SCRIPT_DIR
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$SCRIPT_DIR"

  local PM2_APP_NAME="${PM2_APP_NAME:-sezinv}"
  local APP_PORT="${APP_PORT:-3333}"
  local GIT_REMOTE="${GIT_REMOTE:-origin}"
  local GIT_BRANCH="${GIT_BRANCH:-}"

  echo "======================================================================"
  echo "  SEZSEC Portal (sezinv) — Production GitHub Update & Deploy"
  echo "  Directory    : $SCRIPT_DIR"
  echo "  PM2 Instance : $PM2_APP_NAME (port $APP_PORT)"
  echo "======================================================================"

  # ----------------------------------------------------------------------------
  # 1. Pre-flight Runtime & Tool Checks
  # ----------------------------------------------------------------------------
  for cmd in git node npm; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      echo "[ERROR] Required command '$cmd' is not installed or not in PATH." >&2
      exit 1
    fi
  done

  if ! command -v pm2 >/dev/null 2>&1; then
    echo "[ERROR] PM2 is not installed or not in PATH. Install with: npm install -g pm2" >&2
    exit 1
  fi

  local NODE_VERSION NODE_MAJOR NPM_VERSION
  NODE_VERSION="$(node -v)"
  NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
  NPM_VERSION="$(npm -v)"

  if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "[ERROR] Node.js v20+ is required (detected $NODE_VERSION)." >&2
    exit 1
  fi

  echo "[1/8] Runtime verified: Node.js $NODE_VERSION, npm v$NPM_VERSION, pm2 v$(pm2 -v)"

  # Ensure .env exists and has restricted permissions
  if [ ! -f ".env" ]; then
    echo "      [WARN] .env not found — bootstrapping .env with generated secrets..."
    if [ -f ".env.example" ]; then
      cp ".env.example" ".env"
    else
      cat > ".env" <<EOF
DATABASE_URL="file:./data/jamatevents.db"
NEON_DATABASE_URL=""
AUTH_SECRET="replace-with-strong-random-secret"
AMOUNT_OTP_SECRET="replace-with-strong-random-secret"
SEZSEC_BRIDGE_KEY="replace-with-strong-shared-bridge-key"
SMTP_EMAIL="info@sezsec.org"
SMTP_PASSWORD=""
NEXT_PUBLIC_APP_URL="http://localhost:${APP_PORT}"
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
  fi

  # Ensure SEZSEC_BRIDGE_KEY and SEZSEC_INTERNAL_URL are present & aligned with sibling ../sezsecnew/.env
  node <<'NODE_EOF'
const fs = require("node:fs");
const path = require("node:path");

if (fs.existsSync(".env")) {
  let envText = fs.readFileSync(".env", "utf8");
  let changed = false;

  let siblingBridgeKey = "";
  for (const rel of ["../sezsecnew/.env"]) {
    const candidate = path.resolve(process.cwd(), rel);
    if (fs.existsSync(candidate)) {
      const raw = fs.readFileSync(candidate, "utf8");
      const m = raw.match(/^\s*SEZSEC_BRIDGE_KEY\s*=\s*"?([^"#\r\n]+)"?/m);
      if (m && m[1].trim() && !m[1].includes("replace-with")) {
        siblingBridgeKey = m[1].trim();
        break;
      }
    }
  }

  if (!/^\s*SEZSEC_BRIDGE_KEY\s*=/m.test(envText)) {
    const keyToUse = siblingBridgeKey || "sezsec-internal-bridge-key-2026";
    envText = envText.replace(/\s*$/, `\nSEZSEC_BRIDGE_KEY="${keyToUse}"\n`);
    changed = true;
  }

  if (!/^\s*SEZSEC_INTERNAL_URL\s*=/m.test(envText)) {
    envText = envText.replace(/\s*$/, `\nSEZSEC_INTERNAL_URL="http://127.0.0.1:3334"\n`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(".env", envText, { mode: 0o600 });
  }
}
NODE_EOF
  chmod 600 ".env" 2>/dev/null || true

  # Resolve SQLite database path from .env (defaults to ./data/jamatevents.db)
  local DB_FILE_PATH
  DB_FILE_PATH="$(node <<'NODE_EOF'
try {
  require("dotenv/config");
} catch (_) {
  const fs = require("node:fs");
  if (fs.existsSync(".env")) {
    for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"#\r\n]+)"?/);
      if (m) process.env.DATABASE_URL = m[1].trim();
    }
  }
}
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

  # ----------------------------------------------------------------------------
  # 2. Pre-Update SQLite Hot Backup
  # ----------------------------------------------------------------------------
  if [ "$DB_FILE_PATH" != ":memory:" ] && [ -f "$DB_FILE_PATH" ] && [ "${SEZINV_BACKUP_DONE:-0}" != "1" ]; then
    local DB_DIR BACKUP_DIR TIMESTAMP BACKUP_FILE
    DB_DIR="$(dirname "$DB_FILE_PATH")"
    BACKUP_DIR="${DB_DIR}/backups"
    TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
    BACKUP_FILE="${BACKUP_DIR}/jamatevents-${TIMESTAMP}.db"

    mkdir -p "$BACKUP_DIR"
    chmod 700 "$BACKUP_DIR" 2>/dev/null || true

    echo "[2/8] Creating pre-update SQLite backup..."
    if DB_SRC="$DB_FILE_PATH" DB_DST="$BACKUP_FILE" node -e '
      const Database = require("better-sqlite3");
      const db = new Database(process.env.DB_SRC, { readonly: true });
      db.backup(process.env.DB_DST)
        .then(() => { db.close(); process.exit(0); })
        .catch((err) => { console.error(err); db.close(); process.exit(1); });
    ' >/dev/null 2>&1; then
      echo "      Atomic online backup saved: $BACKUP_FILE"
    elif command -v sqlite3 >/dev/null 2>&1; then
      sqlite3 "$DB_FILE_PATH" ".backup '$BACKUP_FILE'"
      echo "      SQLite CLI backup saved: $BACKUP_FILE"
    else
      cp -p "$DB_FILE_PATH" "$BACKUP_FILE"
      if [ -f "${DB_FILE_PATH}-wal" ]; then
        cp -p "${DB_FILE_PATH}-wal" "${BACKUP_FILE}-wal"
      fi
      echo "      File copy backup saved: $BACKUP_FILE"
    fi
    chmod 600 "$BACKUP_FILE" 2>/dev/null || true

    # Prune older backups — keep the 10 most recent snapshots
    ls -1t "${BACKUP_DIR}"/jamatevents-*.db 2>/dev/null | tail -n +11 | while IFS= read -r old_bak; do
      rm -f "$old_bak" "${old_bak}-wal" "${old_bak}-shm"
    done
  else
    echo "[2/8] Pre-update SQLite backup complete (or fresh database)."
  fi

  # ----------------------------------------------------------------------------
  # 3. Fetch & Sync Latest Code from GitHub
  # ----------------------------------------------------------------------------
  if [ -z "$GIT_BRANCH" ]; then
    GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
    if [ "$GIT_BRANCH" = "HEAD" ] || [ -z "$GIT_BRANCH" ]; then
      GIT_BRANCH="master"
    fi
  fi

  local PRE_HEAD POST_HEAD LOCAL_DIRTY
  PRE_HEAD="$(git rev-parse HEAD)"

  echo "[3/8] Fetching latest changes from GitHub ($GIT_REMOTE/$GIT_BRANCH)..."
  git fetch --prune "$GIT_REMOTE" "$GIT_BRANCH"

  # Discard chmod-only or generated file mode drift, and safely stash any unexpected
  # tracked file edits (never touching untracked .env or data/* SQLite files).
  git checkout -- setup.sh update.sh 2>/dev/null || true
  LOCAL_DIRTY="$(git status --porcelain --untracked-files=no)"
  if [ -n "$LOCAL_DIRTY" ]; then
    echo "      Stashing local tracked changes before syncing to $GIT_REMOTE/$GIT_BRANCH..."
    git stash push -m "sezinv-pre-update-$(date +%Y%m%d-%H%M%S)" >/dev/null 2>&1 || true
  fi

  git reset --hard "${GIT_REMOTE}/${GIT_BRANCH}"
  chmod +x setup.sh update.sh 2>/dev/null || true

  POST_HEAD="$(git rev-parse HEAD)"
  if [ "$PRE_HEAD" = "$POST_HEAD" ]; then
    echo "      Already at latest commit: $(git rev-parse --short HEAD)"
  else
    echo "      Updated $(git rev-parse --short "$PRE_HEAD") -> $(git rev-parse --short "$POST_HEAD")"
    git --no-pager log --oneline "${PRE_HEAD}..${POST_HEAD}" | sed 's/^/        /'

    # If update.sh itself changed in this pull, re-exec once so new steps take effect immediately
    if [ "${SEZINV_UPDATE_REEXEC:-0}" != "1" ] && git diff --name-only "$PRE_HEAD" "$POST_HEAD" -- update.sh | grep -q '^update\.sh$'; then
      echo "      update.sh was updated from GitHub — reloading updated script..."
      SEZINV_UPDATE_REEXEC=1 SEZINV_BACKUP_DONE=1 exec bash "$SCRIPT_DIR/update.sh" "$@"
    fi
  fi

  # ----------------------------------------------------------------------------
  # 4. Install / Update Dependencies
  # ----------------------------------------------------------------------------
  echo "[4/8] Installing npm dependencies..."
  npm install --no-audit --no-fund

  # ----------------------------------------------------------------------------
  # 5. Prisma Client, Schema Sync & Database Sanctioning
  # ----------------------------------------------------------------------------
  echo "[5/8] Generating Prisma client, syncing schema & sanctioning SQLite DB..."
  if [ "$DB_FILE_PATH" != ":memory:" ]; then
    local DB_DIR_ENSURE
    DB_DIR_ENSURE="$(dirname "$DB_FILE_PATH")"
    mkdir -p "$DB_DIR_ENSURE"
    chmod 700 "$DB_DIR_ENSURE" 2>/dev/null || true
  fi

  npx prisma generate
  npx prisma db push
  npx tsx prisma/sanction-db.ts

  if [ "$DB_FILE_PATH" != ":memory:" ]; then
    for f in "$DB_FILE_PATH" "${DB_FILE_PATH}-wal" "${DB_FILE_PATH}-shm"; do
      if [ -f "$f" ]; then
        chmod 600 "$f" 2>/dev/null || true
      fi
    done
  fi

  # ----------------------------------------------------------------------------
  # 6. TypeScript Check & Production Next.js Build
  # ----------------------------------------------------------------------------
  echo "[6/8] Running Next.js route typegen & TypeScript verification..."
  npx next typegen
  npx tsc --noEmit
  echo "      TypeScript check passed (0 errors)."

  echo "[7/8] Building optimized Next.js production bundle..."
  npm run build

  # ----------------------------------------------------------------------------
  # 7. Restart / Provision PM2 Instance (`sezinv` on Port 3333)
  # ----------------------------------------------------------------------------
  echo "[8/8] Restarting PM2 instance '$PM2_APP_NAME' on port $APP_PORT..."
  if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    PORT="$APP_PORT" NODE_ENV="production" pm2 restart "$PM2_APP_NAME" --update-env
  else
    echo "      PM2 process '$PM2_APP_NAME' not found — creating new instance on port $APP_PORT..."
    PORT="$APP_PORT" NODE_ENV="production" pm2 start npm --name "$PM2_APP_NAME" --cwd "$SCRIPT_DIR" -- start -- -p "$APP_PORT"
  fi

  pm2 save >/dev/null 2>&1 || pm2 save

  # Verify HTTP readiness on 127.0.0.1:3333
  if command -v curl >/dev/null 2>&1; then
    local READY=0
    local HTTP_CODE=""
    for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
      HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${APP_PORT}/login" || true)"
      if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
        READY=1
        echo "      Readiness check passed: http://127.0.0.1:${APP_PORT}/login -> HTTP $HTTP_CODE"
        break
      fi
      sleep 1
    done
    if [ "$READY" -ne 1 ]; then
      echo "      [WARN] Port $APP_PORT did not return HTTP 200 within 12s (last status: ${HTTP_CODE:-none})."
      echo "             Inspect logs with: pm2 logs $PM2_APP_NAME --lines 50"
    fi
  fi

  pm2 status "$PM2_APP_NAME"

  echo "======================================================================"
  echo "  Update Completed Successfully!"
  echo "  Commit       : $(git rev-parse --short HEAD)"
  echo "  PM2 Instance : $PM2_APP_NAME"
  echo "  Port         : $APP_PORT"
  echo "======================================================================"
}

main "$@"
exit 0
