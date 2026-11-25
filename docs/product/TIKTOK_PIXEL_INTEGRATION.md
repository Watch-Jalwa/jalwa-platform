# Jalwa — TikTok Pixel integration

**Marketing only.** Pixel totals are not the official source of truth for paid subscriptions, revenue, or entitlement. Prefer JazzCash PayViaToken / Status Inquiry / IPN + database attribution.

## Client campaign

| Item | Value |
| --- | --- |
| Landing URL | `https://watch-jalwa.com/landing1?utm=T&package=1&parameter=monthly10k&payment=jazzcash` |
| KFC variant | `https://watch-jalwa.com/landing1?utm=T&package=1&parameter=kfcvoucher&payment=jazzcash` |
| Path | `/landing1` |
| TikTok Pixel ID | `DBU5R83C77UCDH70PUCG` |
| Traffic marker | `utm=T` |
| Approved events | `PageView`, `ViewContent`, `InitiateCheckout`, `AddPaymentInfo`, `Subscribe` only |
| KFC banners | web `/landing/kfc-web-banner.png`, mobile `/landing/kfc-mobile-banner.png` |

## Env

```dotenv
TIKTOK_PIXEL_ID=DBU5R83C77UCDH70PUCG
NEXT_PUBLIC_TIKTOK_PIXEL_ID=DBU5R83C77UCDH70PUCG
```

Resolution: runtime meta (`jalwa-tiktok-pixel-id`) ← `TIKTOK_PIXEL_ID` ← `NEXT_PUBLIC_TIKTOK_PIXEL_ID` ← product default `DBU5R83C77UCDH70PUCG`.

## Event map (client-approved only)

| Moment | TikTok event | Where |
| --- | --- | --- |
| Any page (site-wide boot) | `PageView` via `ttq.page()` | `TikTokPixelBoot` |
| Landing open | `ViewContent` | `LandingAnalyticsBoot` → `trackLandingView` |
| JazzCash number + Subscribe Now | `InitiateCheckout` + `AddPaymentInfo` | `LandingSubscribe` → `trackLandingCheckoutIntent` |
| JazzCash payment success (`?premium=enabled&order=…&cv=…`) | `Subscribe` (deduped by `order`) | `PostJazzcashAuthPrompt` → verified conversion receipt → `trackLandingPaymentSuccess` |
| Payment failed / pending / wallet-link only (no subscription id) | _(none)_ | — |

**Do not fire** `AddToCart` or `CompletePayment` unless newly requested.

`order` on the return URL is the granted `subscriptionId` from `/callback` — used only as TikTok `event_id` for dedupe. Wallet linking alone never fires `Subscribe`.

`cv` is a short-lived signed conversion receipt. JazzCash returns via cross-site POST, so SameSite=Lax cookies are unreliable; the client posts `cv` (or the receipt cookie) to `/api/campaign/conversion-receipt` before tracking.

## Code map

| Concern | Path |
| --- | --- |
| Loader / track / dedupe | `apps/web/lib/tiktok-pixel.mjs` |
| Funnel helpers | `apps/web/lib/landing-analytics.mjs` |
| Runtime meta | `apps/web/app/tiktok-runtime-config.tsx` |
| Site-wide boot | `apps/web/components/tiktok-pixel-boot.tsx` |
| CSP (Next) | `apps/web/next.config.ts` |
| CSP (Caddy) | `infrastructure/production/Caddyfile` |
| Agent playbook (Jalwa) | `TIKTOK_PIXEL_AGENT_GUIDE.md` |
| Portable playbook + §3A | `resources/TIKTOK_PIXEL_AGENT_GUIDE.md` |

## Verification

1. Open the campaign landing URL above.
2. Confirm `<meta name="jalwa-tiktok-pixel-id" content="DBU5R83C77UCDH70PUCG">`.
3. Network: `analytics.tiktok.com` not CSP-blocked.
4. Pixel Helper: PageView + ViewContent on load; **only** InitiateCheckout + AddPaymentInfo on CTA (no AddToCart).
5. Staging success that grants `subscriptionId`: return URL includes `order=` + `cv=` → one `Subscribe` beacon (no CompletePayment); reload same order → no second Subscribe.
6. Events Manager Overview may lag ~30 minutes; use Test Events / network for immediate proof.

## Incident — `Subscribe` missing (Nov 2026)

**Observed:** Events Manager Active for `ViewContent` / `InitiateCheckout` / `AddPaymentInfo`, but no `Subscribe`, after JazzCash on the campaign landing URL above.

**Why:** Not a wrong Pixel ID. (1) `Subscribe` is gated on granted `subscriptionId` + verified conversion receipt — wallet-link alone must not fire it. (2) JazzCash returns via cross-site POST; a `SameSite=Lax` receipt cookie set on `/callback` was often dropped, so the client never called `ttq.track('Subscribe')`.

**Fix:** Pass signed `cv` on redirect; accept `cv` or cookie at `/api/campaign/conversion-receipt`; use `SameSite=None; Secure` receipt cookie on HTTPS. Portable write-up + checklist for other products: `resources/TIKTOK_PIXEL_AGENT_GUIDE.md` §3A (repo copy: `TIKTOK_PIXEL_AGENT_GUIDE.md` §3A).

| Concern | Path |
| --- | --- |
| Callback + `cv` + cookie | `apps/web/app/callback/route.ts` |
| Receipt verify | `apps/web/app/api/campaign/conversion-receipt/route.ts` |
| Fire Subscribe after verify | `apps/web/components/post-jazzcash-auth-prompt.tsx` |
