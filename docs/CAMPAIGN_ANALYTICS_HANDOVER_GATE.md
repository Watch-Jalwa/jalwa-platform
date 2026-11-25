# Campaign analytics — handover gate (24 November 2026)

Owner: product/engineering. Branch: feat/campaign-analytics-admin-v1, draft PR #184.
Production and live payment/email/GA4 are NOT authorized by this checklist.

## Evidence already accepted
- Excel #181 closed, authenticated XLSX/API and prior-day MIME reconciliation.
- Prior deployed candidate 818a90d1bc79f57eda82dfa71b3a2e2a27d9483e: staging admin/browser 12/12, run 45367473240.
- Email safety candidate b1e64645a4ff02df84d9ae888124a0c43326ef46: full CI 45372228676 passed; real email remains untested.
- Conversion hardening 0f11b23b71151499b7ae8f2e22d60110d4e0cce6: signed conversion receipt, account-bound immutable attribution, browser consent/dedupe, GA client identity correction. Candidate run 45373920574. No external event or provider-payment certification.

## Latest candidate release procedure
- One guarded branch-only staging workflow validates lint/typecheck/web tests, checks current staging is still the last accepted release, builds immutable images, preserves data and backup/restore evidence, verifies exact SHA and runs the reusable authenticated browser QA on that same SHA.
- All flags start disabled; only campaign analytics is temporarily enabled for QA and then restored. Email/GA4 remain disabled; mock payments only.
- Never merge or declare release accepted on a queued or failed run. Retain complete job artifacts and exact SHA. Do not silently overwrite a changed staging deployment.

## Product/operations inputs still required
1. Approved real report recipients, daily PKT send time, staging SMTP credentials and controlled mailbox access; audited recovery/resend and receipt across two reporting days.
2. Payment-service sandbox/test credentials and exact signed requestId + paymentId + verified subscription contract, including failures/replays and renewal/refund rules; no guessed attribution. Wallet-link-only is not paid.
3. Authorized GA4 property and API secret/custom dimensions, approved TikTok test pixel/Events Manager access; real paid callback and conversion dedupe evidence. HE and MPIN definitions remain explicitly unknown/not observable. **TikTok note (Nov 2026):** CTA events Active with missing `Subscribe` was caused by wallet-link≠grant plus JazzCash cross-site POST dropping the Lax conversion-receipt cookie — fixed via `?cv=` + `SameSite=None` receipt path (`ec40804…` on watch-jalwa). Re-verify one granted-subscription return + Test Events; see `resources/TIKTOK_PIXEL_AGENT_GUIDE.md` §3A and `docs/product/TIKTOK_PIXEL_INTEGRATION.md`.
4. Staff admin provisioning through the existing identity system, least privilege, secure credential sharing out-of-band, product-owner staging UAT.
5. Review/merge #184 only after #174 and child issues reconciled with exact SHA and evidence. Separate explicit production release approval, rollback plan and smoke tests.

## Handover links
- Studio: https://jalwa-platform.codistan.org/admin-login (staging; restricted account required)
- Epic: https://github.com/Watch-Jalwa/jalwa-platform/issues/174
- Daily mail: https://github.com/Watch-Jalwa/jalwa-platform/issues/182
- Final QA: https://github.com/Watch-Jalwa/jalwa-platform/issues/183
- Runbook: CAMPAIGN_ANALYTICS_STAGING_RUNBOOK.md

No credentials, payment records or recipient addresses belong in GitHub.
