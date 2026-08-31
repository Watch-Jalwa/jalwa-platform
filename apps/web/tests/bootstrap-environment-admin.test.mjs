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

test("staging infrastructure is explicitly isolated from production identity", () => {
  assert.match(terraform, /tags\s*=\s*\["jalwa", var\.deployment_environment, "web", "worker"\]/);
  assert.match(terraform, /environment\s*=\s*title\(var\.deployment_environment\)/);
  assert.match(variables, /contains\(\["production", "staging"\], var\.deployment_environment\)/);
  assert.match(staging, /-var="project_name=jalwa-staging"/);
  assert.match(staging, /-var="deployment_environment=staging"/);
  assert.doesNotMatch(terraform, /tags\s*=\s*\["jalwa", "production", "web", "worker"\]/);
});

test("bootstrap uses explicit environment administration and idempotent generated secrets", () => {
  for (const workflow of [staging, production]) {
    assert.match(workflow, /GITHUB_ENV_ADMIN_TOKEN/);
    assert.match(workflow, /scripts\/seed-environment-secrets\.sh/);
    assert.match(workflow, /with-digitalocean-ssh-access\.sh/);
    assert.doesNotMatch(workflow, /DIGITALOCEAN_SSH_PUBLIC_KEY/);
  }
  assert.match(staging, /gh variable set STAGING_FIREWALL_ID/);
  assert.match(production, /gh variable set PRODUCTION_FIREWALL_ID/);
  assert.match(production, /gh variable set R2_INCOMING_BUCKET/);
  assert.match(production, /gh variable set R2_PROCESSED_BUCKET/);
  assert.match(production, /gh variable set R2_BACKUP_BUCKET/);
  assert.match(outputs, /output "firewall_id"/);
  assert.match(seeder, /gh secret list/);
  assert.match(seeder, /has_secret "\$name" \|\| set_secret "\$name" "\$value"/);
  assert.match(seeder, /refusing to rotate it/);
});

test("persistent SSH CIDRs are optional and omitted by default", () => {
  for (const workflow of [staging, production]) {
    assert.match(workflow, /admin_cidr:\n\s+description: Optional persistent SSH CIDR/);
    assert.match(workflow, /admin_cidr:[\s\S]{0,220}required: false/);
    assert.match(workflow, /admin_cidrs='\[\]'/);
    assert.match(workflow, /if \[\[ -n "\$ADMIN_CIDR" \]\]; then/);
    assert.match(workflow, /-var="admin_cidrs=\$admin_cidrs"/);
  }
  assert.match(variables, /variable "admin_cidrs"[\s\S]*default\s*=\s*\[\]/);
  assert.match(terraform, /dynamic "inbound_rule"/);
  assert.match(terraform, /for_each = length\(var\.admin_cidrs\) > 0 \? \[1\] : \[\]/);
});

test("GitHub-hosted deploys use temporary runner SSH access and run-scoped GHCR credentials", () => {
  for (const workflow of [deployStaging, deployProduction]) {
    assert.match(workflow, /DIGITALOCEAN_TOKEN/);
    assert.match(workflow, /with-digitalocean-ssh-access\.sh/);
    assert.match(workflow, /GHCR_USERNAME: \$\{\{ github\.actor \}\}/);
    assert.match(workflow, /GHCR_DEPLOY_TOKEN: \$\{\{ github\.token \}\}/);
    assert.doesNotMatch(workflow, /GHCR_USERNAME: \$\{\{ secrets\.GHCR_USERNAME \}\}/);
    assert.doesNotMatch(workflow, /GHCR_DEPLOY_TOKEN: \$\{\{ secrets\.GHCR_DEPLOY_TOKEN \}\}/);
  }
  assert.match(deployStaging, /STAGING_FIREWALL_ID/);
  assert.match(deployProduction, /PRODUCTION_FIREWALL_ID/);
  assert.match(sshAccess, /\/v2\/firewalls\/\$firewall_id\/rules/);
  assert.match(sshAccess, /-X POST/);
  assert.match(sshAccess, /-X DELETE/);
  assert.match(sshAccess, /runner_cidr="\$runner_ip\/32"/);
});
