import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

const staging = read(".github/workflows/bootstrap-staging.yml");
const production = read(".github/workflows/bootstrap-platform.yml");
const deployStaging = read(".github/workflows/deploy-staging.yml");
const deployProduction = read(".github/workflows/deploy-production.yml");
const terraform = read("infrastructure/digitalocean/main.tf");
const variables = read("infrastructure/digitalocean/variables.tf");
const outputs = read("infrastructure/digitalocean/outputs.tf");
const seeder = read("scripts/seed-environment-secrets.sh");
const sshAccess = read("scripts/with-digitalocean-ssh-access.sh");

test("staging infrastructure is explicitly on-prem while production cloud provisioning remains isolated", () => {
  assert.match(staging, /Bootstrap staging \(retired DigitalOcean path\)/);
  assert.match(staging, /environment: staging/);
  assert.match(staging, /existing Codistan on-prem server at jalwa-platform\.codistan\.org/);
  assert.match(staging, /No infrastructure was changed/);
  assert.doesNotMatch(staging, /terraform apply|-var="project_name=jalwa-staging"|digitalocean\.tfstate/);
  assert.match(deployStaging, /HOST: \$\{\{ vars\.STAGING_HOST \|\| 'jalwa-platform\.codistan\.org' \}\}/);
  assert.match(deployStaging, /APP_DIR: \$\{\{ vars\.STAGING_APP_DIR \|\| '\/opt\/jalwa' \}\}/);
  assert.doesNotMatch(deployStaging, /STAGING_FIREWALL_ID|with-digitalocean-ssh-access\.sh/);

  assert.match(terraform, /tags\s*=\s*\["jalwa", var\.deployment_environment, "web", "worker"\]/);
  assert.match(terraform, /environment\s*=\s*title\(var\.deployment_environment\)/);
  assert.match(variables, /contains\(\["production", "staging"\], var\.deployment_environment\)/);
  assert.doesNotMatch(terraform, /tags\s*=\s*\["jalwa", "production", "web", "worker"\]/);
});

test("retired staging bootstrap cannot mutate infrastructure while production bootstrap keeps explicit idempotent administration", () => {
  assert.doesNotMatch(staging, /GITHUB_ENV_ADMIN_TOKEN|scripts\/seed-environment-secrets\.sh|with-digitalocean-ssh-access\.sh|gh variable set|terraform apply/);
  assert.match(staging, /contents: read/);

  assert.match(production, /GITHUB_ENV_ADMIN_TOKEN/);
  assert.match(production, /scripts\/seed-environment-secrets\.sh/);
  assert.match(production, /with-digitalocean-ssh-access\.sh/);
  assert.doesNotMatch(production, /DIGITALOCEAN_SSH_PUBLIC_KEY/);
  assert.match(production, /gh variable set PRODUCTION_FIREWALL_ID/);
  assert.match(production, /gh variable set R2_INCOMING_BUCKET/);
  assert.match(production, /gh variable set R2_PROCESSED_BUCKET/);
  assert.match(production, /gh variable set R2_BACKUP_BUCKET/);
  assert.match(outputs, /output "firewall_id"/);
  assert.match(seeder, /gh secret list/);
  assert.match(seeder, /has_secret "\$name" \|\| set_secret "\$name" "\$value"/);
  assert.match(seeder, /refusing to rotate it/);
});

test("persistent cloud SSH CIDRs remain optional for production and staging uses only pinned on-prem SSH", () => {
  assert.match(production, /admin_cidr:\n\s+description: Optional persistent SSH CIDR/);
  assert.match(production, /admin_cidr:[\s\S]{0,220}required: false/);
  assert.match(production, /admin_cidrs='\[\]'/);
  assert.match(production, /if \[\[ -n "\$ADMIN_CIDR" \]\]; then/);
  assert.match(production, /-var="admin_cidrs=\$admin_cidrs"/);
  assert.match(variables, /variable "admin_cidrs"[\s\S]*default\s*=\s*\[\]/);
  assert.match(terraform, /dynamic "inbound_rule"/);
  assert.match(terraform, /for_each = length\(var\.admin_cidrs\) > 0 \? \[1\] : \[\]/);

  assert.doesNotMatch(staging, /admin_cidr|admin_cidrs/);
  assert.match(deployStaging, /STAGING_SSH_KNOWN_HOSTS/);
  assert.match(deployStaging, /STAGING_SSH_KEY/);
  assert.match(deployStaging, /StrictHostKeyChecking=yes/);
  assert.doesNotMatch(deployStaging, /ssh-keyscan|DIGITALOCEAN_TOKEN/);
});

test("staging uses pinned direct SSH and run-scoped GHCR credentials while production keeps temporary cloud-runner access", () => {
  assert.match(deployStaging, /password: \$\{\{ github\.token \}\}/);
  assert.match(deployStaging, /GHCR_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(deployStaging, /GITHUB_ACTOR/);
  assert.match(deployStaging, /StrictHostKeyChecking=yes/);
  assert.doesNotMatch(deployStaging, /GHCR_USERNAME: \$\{\{ secrets\.GHCR_USERNAME \}\}|GHCR_DEPLOY_TOKEN: \$\{\{ secrets\.GHCR_DEPLOY_TOKEN \}\}/);
  assert.doesNotMatch(deployStaging, /DIGITALOCEAN_TOKEN|STAGING_FIREWALL_ID|with-digitalocean-ssh-access\.sh/);

  assert.match(deployProduction, /DIGITALOCEAN_TOKEN/);
  assert.match(deployProduction, /with-digitalocean-ssh-access\.sh/);
  assert.match(deployProduction, /GHCR_USERNAME: \$\{\{ github\.actor \}\}/);
  assert.match(deployProduction, /GHCR_DEPLOY_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(deployProduction, /PRODUCTION_FIREWALL_ID/);
  assert.doesNotMatch(deployProduction, /GHCR_USERNAME: \$\{\{ secrets\.GHCR_USERNAME \}\}|GHCR_DEPLOY_TOKEN: \$\{\{ secrets\.GHCR_DEPLOY_TOKEN \}\}/);
  assert.match(sshAccess, /\/v2\/firewalls\/\$firewall_id\/rules/);
  assert.match(sshAccess, /-X POST/);
  assert.match(sshAccess, /-X DELETE/);
  assert.match(sshAccess, /runner_cidr="\$runner_ip\/32"/);
});
