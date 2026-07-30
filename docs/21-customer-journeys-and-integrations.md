# Customer journeys and integration completion

This release completes the browser-based MVP journeys that can be implemented without merchant credentials or licensed partner feeds.

## Customer UI

- Email magic-link signup and sign-in
- Phone OTP request and verification through Supabase Auth
- Google, Apple and Facebook OAuth launch actions
- Post-auth onboarding with language, display name, terms acceptance and plan intent
- Up to five viewer profiles with child/kids mode and an active-profile cookie
- Watch history, resume playback and clear-history controls
- Browser device registration and remote revocation
- Browser offline downloads for self-hosted MP4 assets
- Premium pricing, checkout states, billing history and entitlement-backed playback

The Vercel frontend preview uses safe demo data and does not create accounts, payments or persistent records.

## Payment integration contract

`PAYMENT_PROVIDER` accepts `mock`, `payfast`, `jazzcash` or `easypaisa`.

For a live provider, configure its `*_CHECKOUT_URL` and secret. Jalwa sends a signed JSON request containing:

- `provider`
- `orderId`
- `amountMinor`
- `currency`
- `returnUrl`
- `webhookUrl`
- `customerEmail`
- `merchantId`

The adapter must return JSON containing `redirectUrl` and `providerOrderReference`. Provider-specific SDKs and field names remain isolated behind that adapter endpoint.

Provider webhooks should be normalized and posted to `/api/webhooks/payments/{provider}` with an HMAC-SHA256 signature in `x-jalwa-signature`:

```json
{
  "eventId": "provider-event-id",
  "orderId": "jalwa-checkout-order-uuid",
  "transactionId": "provider-transaction-id",
  "amountMinor": 29900,
  "currency": "PKR",
  "status": "succeeded"
}
```

Entitlements are activated only from a verified webhook. Browser redirects never activate Premium.

## Content integrations

Jalwa supports official YouTube embeds, self-hosted MP4/HLS from R2, partner-hosted playback and external links. The resilient YouTube player surfaces unavailable-source errors and retains the original-source link. Licensed live channels, sports feeds and premium catalogues still require contracts, credentials and source metadata from each partner; no implementation can manufacture those rights or feeds.

## Offline restrictions

Offline caching is enabled only for self-hosted MP4 playback. YouTube and partner embeds are never downloaded. HLS offline packaging requires an additional encrypted segment-download worker and is deliberately excluded until rights and device-security requirements are approved.
