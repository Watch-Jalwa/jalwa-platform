import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const helper = new URL("../../../scripts/with-digitalocean-ssh-access.sh", import.meta.url).pathname;

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "jalwa-do-firewall-"));
  const bin = join(root, "bin");
  const log = join(root, "curl.log");
  mkdirSync(bin);
  const curl = join(bin, "curl");
  writeFileSync(curl, `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "$CURL_LOG"\nexit 0\n`);
  chmodSync(curl, 0o755);
  return { root, bin, log };
}

function runWithMock(command = ["bash", "-c", "exit 0"], ip = "203.0.113.44") {
  const f = fixture();
  const result = spawnSync("bash", [helper, "firewall-test-123", ...command], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${f.bin}:${process.env.PATH}`,
      CURL_LOG: f.log,
      DIGITALOCEAN_TOKEN: "test-token",
      RUNNER_PUBLIC_IP: ip,
    },
  });
  const log = (() => {
    try { return readFileSync(f.log, "utf8"); } catch { return ""; }
  })();
  rmSync(f.root, { recursive: true, force: true });
  return { result, log };
}

test("temporary DigitalOcean SSH rule is added and removed around a successful command", () => {
  const { result, log } = runWithMock();
  assert.equal(result.status, 0, result.stderr);
  assert.match(log, /-X POST/);
  assert.match(log, /-X DELETE/);
  assert.match(log, /\/v2\/firewalls\/firewall-test-123\/rules/);
  assert.match(log, /203\.0\.113\.44\/32/);
});

test("temporary DigitalOcean SSH rule is removed when the protected command fails", () => {
  const { result, log } = runWithMock(["bash", "-c", "exit 23"]);
  assert.equal(result.status, 23, result.stderr);
  assert.match(log, /-X POST/);
  assert.match(log, /-X DELETE/);
});

test("invalid runner IP is rejected before changing the firewall", () => {
  const { result, log } = runWithMock(["bash", "-c", "exit 0"], "999.2.3.4");
  assert.equal(result.status, 65);
  assert.equal(log, "");
  assert.match(result.stderr, /valid GitHub runner public IPv4/);
});
