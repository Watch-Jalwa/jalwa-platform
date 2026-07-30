#!/usr/bin/env bash
set -Eeuo pipefail

TAG="${1:-}"
APP_DIR="${APP_DIR:-/opt/jalwa}"
ENV_FILE="${APP_DIR}/.env.production"
COMPOSE_FILE="${APP_DIR}/docker-compose.yml"

if [[ -z "$TAG" ]]; then
  echo "Usage: $0 <previous-image-tag>" >&2
  exit 2
fi
if [[ ! -f "$ENV_FILE" || ! -f "$COMPOSE_FILE" ]]; then
  echo "Production files are missing from ${APP_DIR}." >&2
  exit 1
fi

cp "$ENV_FILE" "${ENV_FILE}.before-rollback-$(date -u +%Y%m%dT%H%M%SZ)"
if grep -q '^JALWA_IMAGE_TAG=' "$ENV_FILE"; then
  sed -i "s/^JALWA_IMAGE_TAG=.*/JALWA_IMAGE_TAG=${TAG}/" "$ENV_FILE"
else
  printf '\nJALWA_IMAGE_TAG=%s\n' "$TAG" >> "$ENV_FILE"
fi

cd "$APP_DIR"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull web worker
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans
"${APP_DIR}/scripts/smoke-test.sh" "https://${PRODUCTION_DOMAIN:-watch-jalwa.com}" "https://api.${PRODUCTION_DOMAIN:-watch-jalwa.com}"

echo "Rolled back Jalwa to image tag ${TAG}."
