# Payment-service JazzCash wallet subscriptions

Status: repository implementation contract for the Jalwa Premium payment-service integration. Production/live charging is not authorized by this document.

## Architecture

The supported integration path is:

`Jalwa browser/PWA → Jalwa Next.js server/BFF → Payment Service → JazzCash hosted wallet portal`

The browser never calls the payment service directly and never receives the product API key or webhook shared secret. Jalwa collects only the JazzCash MSISDN plus explicit auto-pay consent. The user enters MPIN only on JazzCash's hosted page.

The payment-service contract is authoritative for wallet state, remote subscription state, plan pricing and payment history. Jalwa remains authoritative for Jalwa access/entitlement decisions after verified server-side reconciliation.

## Runtime configuration

Server-only values:

- `PAYMENT_SERVICE_ENABLED` — explicit integration flag; ordinary mock staging keeps the integration disabled except during the protected payment-service preflight.
- `PAYMENT_SERVICE_BASE_URL` — HTTPS payment-service origin ending before `/v1`.
- `PAYMENT_SERVICE_API_KEY` — product API key sent as `X-Api-Key` by Jalwa server requests only.
- `PAYMENT_SERVICE_WEBHOOK_SECRET` — HMAC-SHA256 product webhook secret.
- `PAYMENT_SERVICE_APP_RETURN_URL` — server-configured Jalwa wallet-return URL.
- `PAYMENT_SERVICE_TIMEOUT_MS` — bounded upstream timeout, default 12 seconds.

No payment-service credential may use a `NEXT_PUBLIC_*` name.

## Jalwa BFF routes

Jalwa exposes authenticated same-origin BFF routes that derive the payment-service `userId` from the Better Auth session:

- `GET /api/payments/plans`
- `POST /api/payments/wallets/link`
- `GET /api/payments/wallets`
- `POST /api/payments/wallets/unlink`
- `GET /api/payments/status`
- `POST /api/payments/subscriptions`
- `POST /api/payments/subscriptions/:id/cancel`
- `GET /api/payments/history`
- `GET /api/payments/history/:id`

The browser never supplies authoritative user ID or payment amount. Subscription and payment detail/cancel routes also prove that the remote resource appears in the current session user's authoritative payment-service state/history before forwarding the ID-based operation.

## Wallet and first-subscription flow

1. User chooses the authoritative monthly/yearly plan and enters an 11–15 digit JazzCash MSISDN.
2. User explicitly consents to wallet-linked recurring debits.
3. Jalwa BFF posts `userId`, `msisdn`, `planCode` and the server-controlled app return URL to the payment service.
4. Jalwa returns the documented hosted portal response to the browser.
5. Browser creates an ephemeral hidden form and POSTs the returned fields to the validated JazzCash portal URL. Sensitive hosted fields are never logged or persisted by Jalwa.
6. JazzCash returns to the payment service. The payment service stores the wallet token and automatically starts the first trial/subscription.
7. Jalwa return UI polls Jalwa BFF wallet/status endpoints. Redirect query parameters are informational only and never grant Premium.
8. Jalwa does not blindly call create-subscription after first wallet success. A linked wallet with no open remote subscription can use the create-subscription endpoint for the documented resubscribe/skip-trial case.

A `409 already_linked` becomes status recovery. A `409 already_subscribed` becomes Already Premium rather than a second charge attempt.

## Authoritative plan and charge semantics

Only payment-service plan catalog values are displayed/sent as plan codes. The browser sends no amount.

Supported initial Premium intervals are monthly and yearly. Full and step successful charges both grant the complete Premium period. Jalwa does not collect a later remainder after step success.

No customer pause/resume, plan switch/proration or ad-hoc `charge now` control is part of v1.

## Webhooks and entitlement projection

Payment-service webhooks arrive at:

`POST /api/webhooks/payment-service`

The route:

- reads the exact raw request body;
- enforces a 64 KiB maximum body;
- requires JSON;
- verifies `X-Payment-Signature` using HMAC-SHA256 over exact raw bytes and the product webhook secret;
- verifies `X-Payment-Event` equals the body `type`;
- validates event ID, user ID and timestamp shape;
- deduplicates by payment-service `eventId`;
- rejects a conflicting payload replay using the same event ID;
- retrieves authoritative user status and plan catalog before entitlement mutation;
- validates remote subscription plan/currency/interval/full amount/step amount against the authoritative plan catalog;
- projects the remote subscription into the existing local Jalwa subscription/entitlement model;
- retains raw payload hash and sanitized audit metadata, not private JazzCash hosted fields.

The authoritative access rules are:

- `trialing` with a future `trial_ends_at` grants bounded trial Premium;
- `active` with `current_period_paid=true` grants Premium through `current_period_end` for either full or step charge;
- `past_due`/`paused` retains access only when the authoritative current period is already paid and still valid;
- `canceled` can retain already-paid access through authoritative `current_period_end` while renewal is stopped;
- `payment_failed` and `expired` do not retain unpaid Premium;
- refund/other remote state is reconciled through the authoritative status/payment-service event sequence rather than browser claims.

The webhook event itself is a notification, not the sole state source: current payment-service status is re-read before Jalwa grants or revokes access, protecting against stale/out-of-order delivery.

## Authoritative payment-history finance projection

For payment/subscription lifecycle events that can change financial history, Jalwa also reads the payment service's uncached per-user payment history and upserts a sanitized local finance projection in `payment_service_payments`.

The projection contains only documented finance fields such as remote payment ID, amount, full/step charge kind, status, transaction reference, response code/message, RRN and remote timestamps. It never stores MPIN, wallet token, `pp_Password`, `pp_SecureHash` or other hosted wallet credentials.

This table is readable only by Finance/Admin through RLS and is surfaced in Studio Finance. It deliberately does not fabricate checkout/subscription relationships that are absent from the documented payment-history response. Customer Billing continues to read authoritative payment history directly through the authenticated BFF.

Existing Premium aggregate reports were designed around local checkout-to-subscription linkage. Because the documented remote payment-history shape does not provide that linkage, remote payment-service transactions are kept in the dedicated authoritative Finance projection rather than being inserted into legacy report sources with guessed plan/renewal relationships. Any future unified revenue/renewal report must be based on a documented provider-side relationship or explicit reporting contract, not inference.

## Customer Billing UX

When the integration is enabled, `/pricing` and `/billing` use payment-service state rather than the legacy local checkout assumptions.

Customer surfaces cover:

- authoritative monthly/yearly pricing;
- JazzCash wallet linking and consent;
- pending/waiting state;
- trialing, initiated, active, past-due, payment-failed, expired and canceled states;
- current period/trial/next-due dates when provided;
- full/step success copy;
- payment history;
- stop renewal/cancel subscription while keeping the wallet linked;
- unlink wallet as a distinct action that stops all future wallet debits;
- recovery for already-linked/already-subscribed and rate-limited states.

The legacy `/api/checkout` path fails closed while `PAYMENT_SERVICE_ENABLED=true`, preventing two simultaneous live Premium purchase paths.

## Staging safety and certification

Ordinary staging remains isolated/mock for general release certification. The dedicated **Payment service staging preflight** takes an exact deployed `main` SHA and deployment run ID, proves the running release identity, temporarily enables the real staging payment-service configuration on the same immutable web image, runs authenticated browser/API boundary checks, and then restores the previous staging environment even on failure.

Required protected staging inputs are documented in `docs/28-self-hosted-staging-environment.md`. Missing mandatory payment-service configuration produces a sanitized `BLOCKED` artifact. A reproducible product/integration failure is `FAILED`.

The automated preflight proves:

- authenticated BFF boundary;
- authoritative monthly/yearly plans/status;
- JazzCash hosted portal URL boundary and POST-form response shape;
- invalid webhook signature rejection;
- representative desktop/mobile Premium UI;
- exact release identity and safe restoration.

The preflight does not claim that a hosted JazzCash MPIN/wallet-link flow completed unless the provider actually supplies a supported sandbox/test-wallet mechanism. The repository does not invent a sandbox MPIN or undocumented provider simulator.

## Full payment UAT

When the provider-owned sandbox/test-wallet capability is available, full UAT must prove on the exact staging release:

1. user authentication;
2. monthly plan selection;
3. wallet link initiation;
4. hosted JazzCash wallet completion;
5. automatic first trial/subscription detection without duplicate create;
6. trial/paid entitlement projection;
7. full or step successful charge behavior as supported by the sandbox;
8. account billing state and payment history;
9. cancel/stop-renewal with paid-period retention where authoritative state permits;
10. wallet unlink with no future debits and correct paid-period handling;
11. failed payment/past-due behavior and automatic retry messaging;
12. duplicate signed webhook idempotency/conflicting replay protection;
13. yearly flow;
14. mobile purchase/return behavior.

No production money or production deployment is authorized by staging preflight/UAT.

## Release decision

Payment implementation may be merged only after normal repository CI is green. Deployment/UAT decisions remain separate:

- missing mandatory external payment configuration/sandbox capability → `BLOCKED`;
- reproducible integration defect → `FAILED`;
- successful automated boundary preflight alone does not equal full payment UAT;
- successful full staging UAT can advance to stakeholder approval;
- production promotion still requires separate explicit approval and the exact tested immutable artifacts.
