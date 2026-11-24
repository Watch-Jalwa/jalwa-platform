# Jalwa Campaign Analytics — implementation contract v1

Source: Campaign Tracking & Analytics developer specification (2 pages). Epic #174; tasks #175–#183.

## Release boundaries
- Extend existing Studio /studio. No second admin.
- Staging feature-flagged rollout only. No production deployment, live merchant operations, or outbound emails without separate authorization.
- Premium finance backend payments are authoritative for paid subscriptions and revenue. GA4/TikTok/browser events are attribution comparisons only.
- Never collect/store/forward OTP, MPIN, payment tokens, or merchant secrets.

## Attribution and events
- Anonymous/session ID linked to nullable user ID and checkout/order ID; durable server-side attribution snapshot.
- Capture utm_source, utm_campaign, utm_medium, utm_content, legacy utm, package, parameter, ref, landing path, creative, consent, timestamps.
- Provisional first-touch policy, 30-day TTL. Preserve original order attribution on returning users and late callbacks.
- Normalize legacy UTM source codes: T TikTok, M Meta, D Direct; unknown otherwise. Never accept URL price: use server-side active plan catalogue.
- Events: landing_view, landing_cta, subscribe, begin_checkout, jazzcash_initiated, mpin_stage_observed (provider signal only), payment_success, payment_failure.
- Events must be idempotent; no sensitive fields in metadata; consent required for marketing identity.

## Metric contracts
- Subs = unique backend-verified completed payment-service Premium full/step charge transactions or transactions explicitly linked to a subscription; pending, failed, refunded and manual grants excluded. Unattributed paid charges appear under Unknown; never guess source from user/time/amount.
- Revenue = gross sum of captured completed payment amount_minor. Refunds are excluded from gross and require a separate net measure. Renewal versus new-activation classification cannot be claimed until provider supplies the agreed transaction-type field.
- Platform, Plan and Parameter breakdowns are different projections of the SAME paid subscriptions; NEVER sum totals across the three dimensions.
- Landing visits are count of accepted landing_view events; unique visitors are distinct attributable anonymous IDs. Anonymous-unidentified counted separately.
- Paywall visits = observed checkout visits, total and unique session counts separately.
- Failure attempts include retries; unique failed orders separately. Include mapped provider reason/code and Unmapped.
- HE/NON HE = unknown until canonical product/provider rule is supplied; NEVER infer from untrusted URL alone.
- MPIN count = null/Not observable until JazzCash provider emits trustworthy stage event. Never fabricate 0.
- Asia/Karachi full-day boundaries for all date filters and scheduled prior-day reports; UTC persisted.

## Admin scope
1. Integrated campaigns: active state, approved link builder, plan mapping, sources, creative/parameter/referral.
2. Reference A date-wise Subs matrix with dynamic Platform / Plan IDs / Parameter-UTM grouped columns and totals.
3. Reference B Basic and Detailed reports showing platform/plan/parameter splits, not summed across dimensions.
4. Filters: Product, Platform, Plan, Parameter, Landing, Referral, Campaign and PKT date range.
5. Layout-matched .xlsx, formula injection controls, audited downloads, selected filters and totals.
6. Daily prior-day email: visits/unique, HE/NON HE/Unknown, paywall, observable MPIN, successes, failures/reasons, secure recipient settings and idempotent scheduler.
7. Authorized staff email/password-only admin access, secure sessions, role checks; no public admin signup.

## Open business/provider inputs (block final sign-off, not infrastructure)
- HE classification provider rule; MPIN-stage observation.
- First touch override; canonical parameter label mapping.
- Approved email recipients, time, timezone and resend policy.
- Refunds/renewals attribution policy.
- GA4 property permissions and custom dimensions.

## Test and release gates
- Tagged link -> landing -> CTA -> signup/pay-first -> server attribution -> verified mock payment -> single Subs/GA4 purchase -> same UI / .xlsx / scheduled preview totals.
- Negative paths: failed/cancelled/duplicate/retried/out-of-order payment, multiple landing pages, PKT midnight, 30-day expiry, consent refusal, malformed plan, blocked GA4, 401/403.
- CI, staging screenshots, sanitized example exports and evidence artifact required. Never silently mark unknown HE/MPIN or unconfigured email as passed.