# Jalwa — TikTok Pixel integration

**Marketing only.** Pixel totals are not the official source of truth for paid subscriptions, revenue, or entitlement. Prefer JazzCash PayViaToken / Status Inquiry / IPN + database attribution.

## Client campaign

| Item | Value |
| --- | --- |
| Landing URL | `https://watch-jalwa.com/landing1?utm=T&package=1&parameter=monthly10k&payment=jazzcash` |
| Path | `/landing1` |
| TikTok Pixel ID | `DBU5R83C77UCDH70PUCG` |
| Traffic marker | `utm=T` |

## Env

```dotenv
TIKTOK_PIXEL_ID=DBU5R83C77UCDH70PUCG
NEXT_PUBLIC_TIKTOK_PIXEL_ID=DBU5R83C77UCDH70PUCG
```

Resolution: runtime meta (`jalwa-tiktok-pixel-id`) ← `TIKTOK_PIXEL_ID` ← `NEXT_PUBLIC_TIKTOK_PIXEL_ID` ← product default `DBU5R83C77UCDH70PUCG`.

## Event map

| Moment | TikTok event | Where |
| --- | --- | --- |
| Any page (site-wide boot) | `PageView` via `ttq.page()` | `TikTokPixelBoot` |
| Landing open | `ViewContent` | `LandingAnalyticsBoot` → `trackLandingView` |
| Subscribe Now CTA | `AddToCart` + `InitiateCheckout` | `LandingSubscribe` → `trackLandingCheckoutIntent` |
| JazzCash payment success (`?premium=enabled&order=…`) | `Subscribe` (deduped by `order`) | `PostJazzcashAuthPrompt` → `trackLandingPaymentSuccess` |
| Payment failed | _(none)_ | — |

`order` on the return URL is `subscriptionId` or JazzCash `requestId` from `/callback` — used only as TikTok `event_id` for dedupe.

## Code map

| Concern | Path |
| --- | --- |
| Loader / track / dedupe | `apps/web/lib/tiktok-pixel.mjs` |
| Funnel helpers | `apps/web/lib/landing-analytics.mjs` |
| Runtime meta | `apps/web/app/tiktok-runtime-config.tsx` |
| Site-wide boot | `apps/web/components/tiktok-pixel-boot.tsx` |
| CSP (Next) | `apps/web/next.config.ts` |
| CSP (Caddy) | `infrastructure/production/Caddyfile` |
| Agent playbook | `TIKTOK_PIXEL_AGENT_GUIDE.md` |

## Verification

1. Open the campaign landing URL above.
2. Confirm `<meta name="jalwa-tiktok-pixel-id" content="DBU5R83C77UCDH70PUCG">`.
3. Network: `analytics.tiktok.com` not CSP-blocked.
4. Pixel Helper: PageView + ViewContent on load; AddToCart + InitiateCheckout on CTA.
5. Staging success with `order` id → one Subscribe; reload same order → no second Subscribe.
