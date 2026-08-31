#!/usr/bin/env bash
set -Eeuo pipefail

environment_name="${1:?environment name is required}"
ssh_secret_name="${2:?SSH secret name is required}"
include_staging_qa="${3:-false}"

: "${GH_TOKEN:?GH_TOKEN with GitHub Environments write permission is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

secret_names="$(gh secret list --repo "$GITHUB_REPOSITORY" --env "$environment_name" --json name --jq '.[].name')"
has_secret() { grep -Fxq "$1" <<<"$secret_names"; }
set_secret() {
  local name="$1" value="$2"
  printf '%s' "$value" | gh secret set "$name" --repo "$GITHUB_REPOSITORY" --env "$environment_name"
  secret_names+=$'\n'"$name"
}
random_secret() { openssl rand -base64 48 | tr -d '\n'; }

install -m 700 -d /tmp/jalwa-bootstrap
key_file=/tmp/jalwa-bootstrap/deploy-key

if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  printf '%s\n' "$DEPLOY_SSH_KEY" > "$key_file"
  chmod 600 "$key_file"
elif has_secret "$ssh_secret_name"; then
  echo "$ssh_secret_name exists but was not exposed to this bootstrap job; refusing to rotate it." >&2
  exit 1
else
  ssh-keygen -q -t ed25519 -N '' -C "jalwa-${environment_name}-deploy" -f "$key_file"
  set_secret "$ssh_secret_name" "$(cat "$key_file")"
fi
ssh-keygen -y -f "$key_file" > /tmp/jalwa-bootstrap/deploy-key.pub

mapfile -t generated < <(node scripts/generate-database-secrets.mjs)
for entry in "${generated[@]}"; do
  name="${entry%%=*}"
  value="${entry#*=}"
  if [[ "$name" == STAGING_QA_SECRET && "$include_staging_qa" != true ]]; then
    continue
  fi
  has_secret "$name" || set_secret "$name" "$value"
done

if ! has_secret PAYMENT_WEBHOOK_SECRET; then
  set_secret PAYMENT_WEBHOOK_SECRET "$(random_secret)"
fi

if ! has_secret BACKUP_AGE_IDENTITY; then
  age-keygen -o /tmp/jalwa-bootstrap/backup-age.key >/dev/null
  set_secret BACKUP_AGE_IDENTITY "$(cat /tmp/jalwa-bootstrap/backup-age.key)"
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'ssh_public_key=%s\n' "$(cat /tmp/jalwa-bootstrap/deploy-key.pub)" >> "$GITHUB_OUTPUT"
fi

echo "Generated missing Jalwa-owned secrets for $environment_name without rotating existing values."
