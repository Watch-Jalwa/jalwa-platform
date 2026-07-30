#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${SUPABASE_ROOT:-/opt/jalwa/supabase}"
SOURCE_DIR="$ROOT/source"
RUNTIME_DIR="$ROOT/runtime"
OVERRIDES_FILE="${SUPABASE_OVERRIDES_FILE:-/opt/jalwa/.env.supabase}"
OVERLAY_FILE="${SUPABASE_OVERLAY_FILE:-$ROOT/docker-compose.jalwa.yml}"
REF="${SUPABASE_DOCKER_REF:?SUPABASE_DOCKER_REF must be a pinned 40-character commit SHA}"

if [[ ! "$REF" =~ ^[0-9a-f]{40}$ ]]; then
  echo "SUPABASE_DOCKER_REF must be an immutable 40-character Git commit SHA." >&2
  exit 1
fi
if [[ ! -s "$OVERRIDES_FILE" ]]; then
  echo "Missing Supabase overrides file: $OVERRIDES_FILE" >&2
  exit 1
fi
if [[ ! -s "$OVERLAY_FILE" ]]; then
  echo "Missing Jalwa Supabase overlay: $OVERLAY_FILE" >&2
  exit 1
fi

mkdir -p "$SOURCE_DIR" "$RUNTIME_DIR"
if [[ ! -d "$SOURCE_DIR/.git" ]]; then
  git -C "$SOURCE_DIR" init
  git -C "$SOURCE_DIR" remote add origin https://github.com/supabase/supabase.git
  git -C "$SOURCE_DIR" sparse-checkout init --cone
  git -C "$SOURCE_DIR" sparse-checkout set docker
fi

git -C "$SOURCE_DIR" fetch --depth 1 origin "$REF"
git -C "$SOURCE_DIR" checkout --detach --force FETCH_HEAD

rsync -a --delete \
  --exclude '.env' \
  --exclude 'volumes/db/data/***' \
  --exclude 'volumes/storage/***' \
  "$SOURCE_DIR/docker/" "$RUNTIME_DIR/"
install -m 0644 "$OVERLAY_FILE" "$RUNTIME_DIR/docker-compose.jalwa.yml"

python3 - "$RUNTIME_DIR/.env.example" "$OVERRIDES_FILE" "$RUNTIME_DIR/.env" <<'PY'
from pathlib import Path
import sys

example_path, override_path, target_path = map(Path, sys.argv[1:])
values = {}
for raw in example_path.read_text().splitlines():
    if raw and not raw.lstrip().startswith("#") and "=" in raw:
        key, value = raw.split("=", 1)
        values[key] = value

for raw in override_path.read_text().splitlines():
    if not raw or raw.lstrip().startswith("#"):
        continue
    if "=" not in raw:
        raise SystemExit(f"Invalid override line: {raw}")
    key, value = raw.split("=", 1)
    values[key] = value

required = [
    "POSTGRES_PASSWORD", "JWT_SECRET", "ANON_KEY", "SERVICE_ROLE_KEY",
    "DASHBOARD_PASSWORD", "SECRET_KEY_BASE", "VAULT_ENC_KEY",
    "PG_META_CRYPTO_KEY", "SUPABASE_PUBLIC_URL", "API_EXTERNAL_URL",
    "SITE_URL", "SMTP_HOST", "SMTP_USER", "SMTP_PASS",
]
missing = [key for key in required if not values.get(key)]
if missing:
    raise SystemExit("Missing required Supabase values: " + ", ".join(missing))

rendered = []
seen = set()
for raw in example_path.read_text().splitlines():
    if raw and not raw.lstrip().startswith("#") and "=" in raw:
        key = raw.split("=", 1)[0]
        rendered.append(f"{key}={values[key]}")
        seen.add(key)
    else:
        rendered.append(raw)
for key, value in values.items():
    if key not in seen:
        rendered.append(f"{key}={value}")
target_path.write_text("\n".join(rendered) + "\n")
PY

chmod 600 "$RUNTIME_DIR/.env"
cd "$RUNTIME_DIR"
compose=(docker compose -f docker-compose.yml -f docker-compose.jalwa.yml)
"${compose[@]}" config --quiet
"${compose[@]}" pull
"${compose[@]}" up -d --wait

docker inspect --format '{{.State.Health.Status}}' supabase-db | grep -qx healthy
docker inspect --format '{{.State.Health.Status}}' supabase-auth | grep -qx healthy
docker inspect --format '{{.State.Health.Status}}' supabase-rest | grep -qx healthy

echo "Self-hosted Supabase is healthy at commit $REF."
