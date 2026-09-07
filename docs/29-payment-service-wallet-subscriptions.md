# Payment-service JazzCash wallet subscriptions

Status: implementation and staging-integration contract. Production/live charging remains disabled until separate explicit approval.

## Architecture

Jalwa uses the product payment service as the only JazzCash integration boundary for this flow:

```text
Browser / PWA
  → Jalwa Next.js BFF (Better Auth session)
  → Payment Service /v1 (X-Api-Key, server only)
  → JazzCash hosted wallet-linking portal

Payment Service
  → signed product webhook
  → Jalwa webhook receiver
  → authoritative status reconciliation
  → PostgreSQL subscription/entitlement projection
  → Billing UI / benefit checks
```

Jalwa never calls JazzCash APIs directly for wallet subscriptions. The browser never receives the product API key. Jalwa collects the JazzCash MSISDN and consent only; JazzCash collects the MPIN on its hosted portal.

## Server configuration

All integration credentials are server-only:

- `PAYMENT_SERVICE_ENABLED` — `true` only in an environment intentionally using this integration.
- `PAYMENT_SERVICE_BASE_URL` — staging/production payment-service origin. HTTPS is required except localhost development.
- `PAYMENT_SERVICE_API_KEY` — product API key sent as `X-Api-Key`; never `NEXT_PUBLIC_*`.
- `PAYMENT_SERVICE_WEBHOOK_SECRET` — HMAC secret for product webhooks; never exposed to the browser.
- `PAYMENT_SERVICE_APP_RETURN_URL` — server-controlled Jalwa URL, normally `https://<domain>/billing/wallet-return`.
- `PAYMENT_SERVICE_TIMEOUT_MS` — bounded upstream timeout, default 12000 ms.

Do not commit real values.

## External payment-service product configuration

The payment-service product record must be configured with values matching the protected Jalwa environment:

- Product API key → protected Jalwa `PAYMENT_SERVICE_API_KEY`.
- Product webhook URL → `https://<jalwa-domain>/api/webhooks/payment-service`.
- Product webhook secret → protected Jalwa `PAYMENT_SERVICE_WEBHOOK_SECRET`.
- Wallet app-return allowlist → Jalwa staging/production origin as applicable.
- Jalwa app return URL → `https://<jalwa-domain>/billing/wallet-return`.

The payment-service/JazzCash sandbox must support the test states used during certification. The repository does not invent provider credentials or undocumented simulation endpoints.

## Jalwa BFF routes

The browser talks only to Jalwa:

| Jalwa route | Upstream payment-service route | Purpose |
|---|---|---|
| `GET /api/payments/plans` | `GET /v1/plans` | authoritative plan catalog |
| `POST /api/payments/wallets/link` | `POST /v1/wallets/link` | start JazzCash wallet link |
| `GET /api/payments/wallets` | `GET /v1/wallets/:userId` | uncached wallet state |
| `POST /api/payments/wallets/unlink` | `POST /v1/wallets/unlink` | delete wallet token / stop future debits |
| `GET /api/payments/status` | `GET /v1/users/:userId/status` | main billing/subscription state |
| `POST /api/payments/subscriptions` | `POST /v1/subscriptions` | resubscribe only when wallet is linked and no open subscription exists |
| `POST /api/payments/subscriptions/:id/cancel` | `POST /v1/subscriptions/:id/cancel` | stop that subscription while keeping wallet linked |
| `GET /api/payments/history` | `GET /v1/users/:userId/payments` | payment history |
| `GET /api/payments/history/:id` | `GET /v1/payments/:id` | payment detail after ownership check |

Every user-scoped route derives `userId` from the Better Auth session. Browser-supplied user IDs are not accepted.

## Wallet-link and first subscription flow

1. Pricing loads monthly/yearly plans from the payment service. Jalwa never sends an amount during subscribe/link.
2. User enters an 11–15 digit JazzCash mobile number and explicitly agrees to automatic subscription debits.
3. Jalwa BFF calls `/v1/wallets/link` with the session user ID, MSISDN, plan code and server-controlled return URL.
4. Jalwa returns the hosted portal URL and transient hidden form fields to its client component.
5. Client auto-submits those fields as POST to JazzCash. `pp_Password` / `pp_SecureHash` are never logged or persisted by Jalwa.
6. JazzCash returns to the payment service; the payment service stores the wallet token and creates the first trial/subscription atomically according to its plan configuration.
7. Browser returns to Jalwa and polls only Jalwa wallet/status APIs.
8. Jalwa does **not** create another subscription merely because the wallet return succeeded. `already_linked` / `already_subscribed` are recovery states, not reasons to charge again.
9. `/v1/subscriptions` is used only when a wallet is already linked and authoritative status shows no open subscription (for example, resubscribe after cancellation).

Browser return query parameters are informational only and never grant Premium.

## Subscription and access projection

The payment service is authoritative for wallet/subscription/payment state. Jalwa remains authoritative for Jalwa benefits.

Remote → local subscription mapping:

| Payment-service status | Jalwa subscription projection | Entitlement rule |
|---|---|---|
| `initiated` | `incomplete` | no paid access unless another authoritative period remains paid |
| `trialing` | `active` | grant through future `trial_ends_at` |
| `active` | `active` | grant through future `current_period_end` when `current_period_paid=true` |
| `past_due` | `past_due` | retain only an already-paid future period; automatic dunning continues remotely |
| `paused` | `past_due` | no v1 customer pause control; retain only an authoritative already-paid future period |
| `payment_failed` | `expired` | revoke unpaid access |
| `expired` | `expired` | revoke access |
| `canceled` | `cancelled` | stop renewal; retain only an authoritative already-paid future period |

A successful `full` or `step` charge grants the same Jalwa Premium benefits for the authoritative period. Jalwa never attempts to collect a remainder after a step charge.

## Webhook security and reconciliation

Endpoint: `POST /api/webhooks/payment-service`.

Required controls:

- `Content-Type: application/json`.
- maximum request body 64 KiB.
- exact raw request body retained only in memory for signature/hash processing.
- `X-Payment-Signature` verified as HMAC-SHA256 hex with `PAYMENT_SERVICE_WEBHOOK_SECRET` using constant-time comparison.
- `X-Payment-Event` must exactly equal body `type`.
- body must contain bounded `eventId`, supported `type`, Jalwa `userId`, valid `createdAt`, and object `data`.
- deduplicate on event ID and raw-body SHA-256 hash.
- an identical retry is idempotent; a conflicting event-ID replay returns conflict.
- before entitlement mutation, Jalwa fetches the current authoritative payment-service status and plan catalog.
- remote subscription amount, step amount, currency and interval must match the current authoritative product plan.
- unknown Jalwa users and invalid plan/state fail closed.
- audit metadata is sanitized; JazzCash MPIN/token/merchant secrets are not stored.

This status reconciliation is the stale/out-of-order protection: webhook data is a notification to reconcile, not a trusted instruction to set access blindly.

## Cancel and unlink

**Cancel subscription** and **unlink wallet** are separate operations.

- Cancel calls the remote subscription cancel endpoint. The wallet remains linked. Future renewal for that subscription stops. If the authoritative state still reports an already-paid future `current_period_end`, Jalwa retains Premium until that time.
- Unlink deletes the remote wallet token and cancels open remote subscriptions. Future JazzCash debits stop. Jalwa still retains any already-paid future period reported by authoritative status; otherwise access is revoked.

The first Premium release does not expose pause/resume, plan switching/proration or a manual “charge now” action.

## Refunds

Refund initiation is an operations/backend concern and is intentionally not exposed as a customer checkout action.

The product webhook contract includes `payment.refunded`. Jalwa reconciles authoritative status before changing entitlement. The contract does not define that every historical refund necessarily cancels the current subscription period, so Jalwa does not invent that behavior from the event name alone. If the payment service changes the authoritative subscription/period state, Jalwa follows that state; any exceptional refund requiring manual financial/access correction remains auditable operational work.

## Polling and rate limits

During wallet linking/first charge, the return page polls Jalwa wallet + status routes roughly every 2–3 seconds and stops after a terminal/usable state. HTTP 429 triggers a longer jittered backoff. The UI never offers a duplicate charge while the first payment is pending.

Normal Billing page loads do not continuously poll.

## Legacy checkout isolation

When `PAYMENT_SERVICE_ENABLED=true`, the legacy `/api/checkout` order-based hosted-checkout route returns `wallet_link_required`. This prevents two customer Premium payment paths from being active at once.

The legacy generic/mock checkout remains available only when the new integration is disabled, preserving existing preview and isolated mock certification until the payment-service staging path has equivalent real evidence.

## Staging certification requirements

Repository/CI success is not staging payment evidence. The exact deployed SHA must prove:

1. authenticated monthly wallet link;
2. hosted JazzCash/payment-service sandbox return;
3. authoritative trial/initiated/active status detection;
4. verified webhook → Jalwa subscription/entitlement projection;
5. payment history/account UI;
6. cancel with correct paid-period behavior;
7. wallet unlink with correct paid-period behavior;
8. failed/past-due behavior supported by the sandbox;
9. duplicate webhook retry idempotency;
10. yearly flow;
11. mobile purchase/return usability.

Missing payment-service host/API key/webhook secret/product configuration or a required JazzCash sandbox capability is `BLOCKED`, not PASS. Production/live charging stays disabled until a separately approved production promotion of the exact staging-tested artifacts.
