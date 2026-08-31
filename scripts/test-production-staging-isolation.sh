#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

require_match() {
  local pattern="$1" file="$2" message="$3"
  grep -Fq -- "$pattern" "$file" || { echo "$message" >&2; exit 1; }
}

require_match 'tags       = ["jalwa", var.deployment_environment, "web", "worker"]' infrastructure/digitalocean/main.tf \
  'DigitalOcean resource tags are not environment-aware.'
require_match 'environment = title(var.deployment_environment)' infrastructure/digitalocean/main.tf \
  'DigitalOcean project environment is not derived from deployment_environment.'
require_match 'contains(["production", "staging"], var.deployment_environment)' infrastructure/digitalocean/variables.tf \
  'DigitalOcean deployment_environment validation is missing.'
require_match '-var="project_name=jalwa-staging"' .github/workflows/bootstrap-staging.yml \
  'Staging bootstrap does not force the jalwa-staging project name.'
require_match '-var="deployment_environment=staging"' .github/workflows/bootstrap-staging.yml \
  'Staging bootstrap does not force the staging environment label.'

if grep -Fq -- 'tags       = ["jalwa", "production", "web", "worker"]' infrastructure/digitalocean/main.tf; then
  echo 'DigitalOcean module still hard-codes production resource tags.' >&2
  exit 1
fi

echo 'Staging DigitalOcean isolation contract passed.'
