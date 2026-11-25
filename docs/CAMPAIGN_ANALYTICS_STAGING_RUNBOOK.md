# Campaign Analytics — staging rollout and acceptance (PR #184)

## Implemented in draft branch
- Integrated Studio campaign reporting, management, daily logs and authorized email/password entry.
- Migration 202611240001_campaign_analytics_foundation.sql.
- Consent-aware landing events and persistent 30-day first-touch record.
- Signed provider request + payment + subscription correlation; unmatched conversions fail closed.
- Backend-only verified payment aggregates; GA4 purchase outbox.
- Formatted two-sheet Excel export matching date-wise and Basic/Detailed reference sections.
- Disabled-by-default staging email and GA4 dispatchers; guarded GitHub scheduler.
- Tests for dedupe, PKT day boundaries, filters and Excel XML.

## Staging rollout steps
1. Keep this PR unmerged until CI passes and human review. No production migration/deployment.
2. Back up staging DB, apply migration using normal migration runner, capture migration SHA.
3. Deploy staging only with flags OFF: JALWA_CAMPAIGN_ANALYTICS_ENABLED=false, JALWA_CAMPAIGN_EMAIL_ENABLED=false, JALWA_CAMPAIGN_GA4_ENABLED=false.
4. Verify legacy Studio finance and authentication still function. Provision existing Better Auth staff email/password and role; reject unauthorised access.
5. Turn on JALWA_CAMPAIGN_ANALYTICS_ENABLED=true in staging after migration. Create test campaign with server-validated plan code.
6. Test consented tagged landing → checkout → signed provider event with exact requestId/paymentId/subscription match. If payment service does not supply those correlation fields, STOP: never infer from user/time/amount.
7. Compare Basic/Detailed, Date-wise Subs, filtered XLSX and backend totals for multiple landing pages, sources, plans and parameters.
8. Obtain GA4 measurement ID, API secret and custom-dimension approval. Only after separate operator authorisation enable JALWA_CAMPAIGN_GA4_ENABLED=true in staging. Verify purchase in GA4 property DebugView.
9. Obtain approved mail recipients/time. Configure Studio daily settings, SMTP; only enable JALWA_CAMPAIGN_EMAIL_ENABLED=true in staging with permission. Validate email body and XLSX against backend, no PII.
10. The scheduled workflow on default branch requires ENABLE_CAMPAIGN_STAGING_JOBS=true and secret JALWA_CAMPAIGN_CRON_SECRET. Runs best-effort every 15 minutes; sender honours PKT delivery time and prior calendar day. No scheduled operation before merge.

## Unresolved business/provider inputs
- HE vs NON HE canonical classification; absent definition means Unknown (not zero).
- JazzCash MPIN shown/submitted observability; absent verified signal means Not observable (not zero).
- First-touch provisional default versus last-touch override.
- Canonical parameter labels, refund/renewal policy.
- Exact GA4 credentials/dimensions and scheduled email recipients/time.
- End-to-end staging evidence, sample email and export screenshot sign-off.

## Completion gate
Epic #174 and issue #183 remain open until complete staging tests, provider correlation evidence, CI, security/role tests, report/Excel comparisons, email test delivery, GA4 DebugView, and release SHA are attached.
No production changes or external emails are authorized by this draft PR.
## SMTP delivery safety and reconciliation (#182)
- The scheduler retries up to three pre-submission failures (including SMTP connection/authentication verification). A pending attempt is never automatically retried: SMTP acceptance may have occurred even if the response or receipt update was lost.
- All configured recipients must be accepted by SMTP before status is marked sent. Partial/ambiguous acceptance leaves the date pending with a sanitized reconciliation marker; SMTP acceptance is not mailbox receipt.
- For an ambiguous pending row, check the deterministic message ID, provider logs and recipient mailbox receipts before any separately authorized recovery. Do not reset a pending row blindly. Do not expose recipient addresses or SMTP errors in public logs. Record per-recipient evidence in a restricted operator record. Admin resend UI and audited recovery remain separate acceptance items.
- Live acceptance remains gated on approved recipient(s), PKT time, authorized staging SMTP configuration and real scheduled mailbox receipt. No external delivery or production activation is authorized by this change.
