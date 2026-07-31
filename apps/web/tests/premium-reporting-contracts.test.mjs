import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../../../supabase/migrations/202607310011_premium_reporting.sql", import.meta.url);
const hardeningUrl = new URL("../../../supabase/migrations/202607310012_premium_reporting_hardening.sql", import.meta.url);
const serviceUrl = new URL("../lib/studio/premium-reports.ts", import.meta.url);
const dataUrl = new URL("../lib/studio/premium-report-data.ts", import.meta.url);
const specialUrl = new URL("../lib/studio/premium-report-special.ts", import.meta.url);
const capabilitiesUrl = new URL("../lib/studio/capabilities.ts", import.meta.url);
const pageUrl = new URL("../app/studio/finance/reports/page.tsx", import.meta.url);
const sectionUrl = new URL("../app/studio/finance/reports/[section]/page.tsx", import.meta.url);
const reportUrl = new URL("../app/api/studio/premium-reports/[report]/route.ts", import.meta.url);
const exportUrl = new URL("../app/api/studio/premium-reports/export/[report]/route.ts", import.meta.url);
const acceptanceUrl = new URL("../../../scripts/premium-reporting-acceptance.mjs", import.meta.url);
const seedUrl = new URL("../../../scripts/seed-premium-reporting-staging.sql", import.meta.url);
const stagingWorkflowUrl = new URL("../../../.github/workflows/staging-acceptance.yml", import.meta.url);

async function text(url) { return readFile(url, "utf8"); }

test("reporting migrations preserve immutable purpose, snapshots, refunds and status history", async () => {
  const [migration, hardening] = await Promise.all([text(migrationUrl), text(hardeningUrl)]);
  assert.match(migration, /payment_purpose/);
  assert.match(migration, /plan_snapshot/);
  assert.match(migration, /price_snapshot/);
  assert.match(migration, /payment_refunds/);
  assert.match(migration, /subscription_status_events/);
  assert.match(migration, /activation_source/);
  assert.match(migration, /auto_renew_consented_at/);
  assert.match(migration, /checkout_orders_reporting_completed_idx/);
  assert.match(hardening, /operation_kind in \('refunded','partially_refunded'\)/);
  assert.match(hardening, /revoke all on function public\.populate_checkout_reporting_fields/);
});

test("backend owns formulas, historical boundaries, pagination, CSV and export auditing", async () => {
  const [service, data] = await Promise.all([text(serviceUrl), text(dataUrl)]);
  assert.match(data, /calculatePremiumSummary/);
  assert.match(data, /subscription_status_events/);
  assert.match(data, /latestEvent/);
  assert.match(data, /order\("created_at", \{ ascending: false \}\)\.order\("id", \{ ascending: false \}\)/);
  assert.match(data, /10,000 rows/);
  assert.match(service, /createHash\("sha256"\)/);
  assert.match(service, /premium_report_exported/);
  assert.match(service, /content_sha256/);
  assert.match(service, /row_count/);
  assert.doesNotMatch(service, /label:\s*"Raw event"|label:\s*"Payload"|value:\s*"payload_hash"/i);
});

test("reconciliation covers stale payments, webhooks, failed renewals and refunds without mutation", async () => {
  const special = await text(specialUrl);
  assert.match(special, /stale_pending_payment/);
  assert.match(special, /failed_or_ignored_webhook/);
  assert.match(special, /failed_renewal/);
  assert.match(special, /refund_not_reflected_in_subscription/);
  assert.match(special, /active_paid_subscription_without_completed_payment/);
  assert.doesNotMatch(special, /\.insert\(|\.update\(|\.delete\(/);
});

test("report and export capabilities are separate and server enforced", async () => {
  const [capabilities, reportRoute, exportRoute] = await Promise.all([
    text(capabilitiesUrl),
    text(reportUrl),
    text(exportUrl),
  ]);
  assert.match(capabilities, /premium:reports:read/);
  assert.match(capabilities, /premium:reports:export/);
  assert.match(capabilities, /premium:reconciliation:run/);
  assert.match(reportRoute, /requirePremiumApiCapability\("premium:reports:read"\)/);
  assert.match(exportRoute, /requirePremiumApiCapability\("premium:reports:export"\)/);
  assert.match(reportRoute, /StudioAccessError/);
  assert.match(exportRoute, /StudioAccessError/);
  assert.match(reportRoute, /private, no-store/);
  assert.match(exportRoute, /private, no-store/);
  assert.match(exportRoute, /auditPremiumExport\(user\.id/);
});

test("existing Studio contains the Premium reporting workspace and backend totals", async () => {
  const [page, section] = await Promise.all([text(pageUrl), text(sectionUrl)]);
  assert.match(page, /Premium reports/);
  assert.match(page, /getPremiumSummary/);
  assert.match(page, /Backend-generated/);
  assert.match(page, /Recurring customers/);
  assert.doesNotMatch(page, /reduce\(/);
  assert.match(section, /Payment ledger/);
  assert.match(section, /Subscription ledger/);
  assert.match(section, /Reconciliation attention/);
  assert.match(section, /loadReport/);
  assert.match(section, /parseContext/);
});

test("staging acceptance seeds representative cases and proves role, export and responsive contracts", async () => {
  const [acceptance, seed, workflow] = await Promise.all([
    text(acceptanceUrl),
    text(seedUrl),
    text(stagingWorkflowUrl),
  ]);
  assert.match(seed, /deployment_environment.*staging/s);
  assert.match(seed, /staging-report-activation/);
  assert.match(seed, /staging-report-renewal/);
  assert.match(seed, /staging-report-failed-renewal/);
  assert.match(seed, /staging-report-failed-activation/);
  assert.match(seed, /staging-report-pending/);
  assert.match(seed, /partial refund/);
  assert.match(seed, /manual_grant/);
  assert.match(seed, /failed-webhook/);
  assert.match(workflow, /seed-reporting-fixtures/);
  assert.match(workflow, /seed-premium-reporting-staging\.sql/);
  assert.match(workflow, /premium-reporting-acceptance\.mjs/);
  assert.match(acceptance, /anonymousReport\.status\(\), 401/);
  assert.match(acceptance, /viewerReport\.status\(\), 403/);
  assert.match(acceptance, /viewerExport\.status\(\), 403/);
  assert.match(acceptance, /premium_report_exported/);
  assert.match(acceptance, /x-jalwa-report-sha256/);
  assert.match(acceptance, /Asia\\\/Karachi/);
  assert.match(acceptance, /width: 390, height: 844/);
});
