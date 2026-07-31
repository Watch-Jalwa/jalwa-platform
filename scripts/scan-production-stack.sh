#!/usr/bin/env bash
set -Eeuo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

: "${JALWA_IMAGE_TAG:?JALWA_IMAGE_TAG must be the immutable release Git SHA}"
[[ "$JALWA_IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]] || { echo "JALWA_IMAGE_TAG must be a lowercase 40-character Git SHA." >&2; exit 1; }

web_image="${WEB_IMAGE:-ghcr.io/watch-jalwa/jalwa-platform-web:${JALWA_IMAGE_TAG}}"
worker_image="${WORKER_IMAGE:-ghcr.io/watch-jalwa/jalwa-platform-worker:${JALWA_IMAGE_TAG}}"
production_compose="${PRODUCTION_COMPOSE:-infrastructure/production/docker-compose.yml}"
supabase_compose="${SUPABASE_COMPOSE:-}"

images=("$web_image" "$worker_image")
mapfile -t production_images < <(docker compose --file "$production_compose" config --images | sort -u)
images+=("${production_images[@]}")

if [[ -n "$supabase_compose" ]]; then
  [[ -f "$supabase_compose" ]] || { echo "Supabase Compose file not found: $supabase_compose" >&2; exit 1; }
  mapfile -t supabase_images < <(docker compose --file "$supabase_compose" config --images | sort -u)
  images+=("${supabase_images[@]}")
fi

mapfile -t unique_images < <(printf '%s\n' "${images[@]}" | awk 'NF && !seen[$0]++')
(( ${#unique_images[@]} > 0 )) || { echo "No production images were resolved." >&2; exit 1; }

for image in "${unique_images[@]}"; do
  docker pull "$image"
done

bash scripts/install-trivy.sh
TRIVY_REPORT_DIR="${TRIVY_REPORT_DIR:-$repository_root/security-reports/containers}" \
  bash scripts/scan-container-images.sh "${unique_images[@]}"

printf 'Scanned %d production images. Reports: %s\n' "${#unique_images[@]}" "${TRIVY_REPORT_DIR:-$repository_root/security-reports/containers}"
