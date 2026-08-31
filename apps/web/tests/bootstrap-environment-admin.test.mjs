import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

const staging = read(".github/workflows/bootstrap-staging.yml");
const production = read(".github/workflows/bootstrap-platform.yml");
const terraform = read("infrastructure/digitalocean/main.tf");
const variables = read("infrastructure/digitalocean/variables.tf");
const seeder = read("scripts/seed-environment-secrets.sh");

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
    assert.doesNotMatch(workflow, /DIGITALOCEAN_SSH_PUBLIC_KEY/);
  }
  assert.match(production, /gh variable set R2_INCOMING_BUCKET/);
  assert.match(production, /gh variable set R2_PROCESSED_BUCKET/);
  assert.match(production, /gh variable set R2_BACKUP_BUCKET/);
  assert.match(seeder, /gh secret list/);
  assert.match(seeder, /has_secret "\$name" \|\| set_secret "\$name" "\$value"/);
  assert.match(seeder, /refusing to rotate it/);
});
