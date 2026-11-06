# Master handoff: Landings + JazzCash + Sign-in + UTM + Admin

**Audience:** Cursor / engineers implementing the **same pattern** in another project  
**Source:** SkillUp (`skillup-platform`)  
**How to use:** Copy this file into the other repo and `@` it. Fill **§0 placeholders** with that product’s JazzCash credentials and landing copy when provided in chat.

**Companions (optional deeper detail):**

| File | Topic |
| --- | --- |
| `resources/DUAL_LANDING_PAGES_HANDOFF.md` | Landing URL / package defaults only |
| `resources/PAY_FIRST_AUTH_AND_PAYMENT_LINKING_HANDOFF.md` | Guest pay → OTP later |
| `resources/SIGNUP_SIGNIN_FIELDS_HANDOFF.md` | OTP form fields only |
| `resources/JAZZCASH_WALLET_LINK_FLOW_HANDOFF.md` | Full JazzCash API / hash |
| `resources/GA4_ANALYTICS_IMPLEMENTATION_HANDOFF.md` | Client GA4 funnel |

---

## 0. Placeholders (fill in the other chat)

| Slot | What to paste later |
| --- | --- |
| `{{PRODUCT_NAME}}` | Product / brand name |
| `{{LANDING_DEFAULT_COPY}}` | Hero banner text, offer notice, course cards for **default** landing |
| `{{LANDING_TIKTOK_COPY}}` | Same for **TikTok** landing (usually yearly / % off) |
| `{{JAZZCASH_MERCHANT_DETAILS}}` | Merchant ID, Password, IntegritySalt, Return URL, IPN URL, env names (never commit secrets) |
| `{{GA_MEASUREMENT_ID}}` | GA4 Measurement ID (`G-…`) |
| `{{ADMIN_BASE_PATH}}` | Admin premium UI path (SkillUp: `/en/admin/premium`) |

---

## 1. Product rules (do not re-debate)

1. **Pay first, sign in later.** User can complete JazzCash wallet link **without** logging in.
2. After JazzCash succeeds, Premium is bound to a **phone-bound user** (account exists, **no browser session**).
3. User must **sign in with the same JazzCash mobile number** (OTP) to open a session and see Premium.
4. Official campaign / Subs report = **succeeded payments + stored attribution** — **not** GA4.
5. GA4 = marketing funnel only; never break checkout if analytics fails.
6. Two public landings: **default** and **TikTok / promo**, same layout shell, different defaults + offer copy.

```text
Landing (guest)
  → enter JazzCash MSISDN + Terms
  → link/start (creates/reuses phone user, NO session)
  → JazzCash hosted LinkWallet (OTP/MPIN only on JazzCash)
  → return → link/complete → PayViaToken → entitlement on that phone user
  → success: “sign in with the same number”
  → OTP sign-in with same MSISDN → session on same user → Premium unlocked
```

---

## 2. Dual landing pages

### 2.1 Routes and defaults

| Concern | Default landing | TikTok / promo landing |
| --- | --- | --- |
| Public path | `/mainLanding` | `/landing2` |
| Analytics `landing` slug | `mainLanding` | `landing2` |
| Default query | `utm=D`, `package=default`, `parameter=default`, `payment=jazzcash` | `utm=T`, `package=2`, `parameter=20percentoff`, `payment=jazzcash` |
| Default plan | Monthly (PKR 599) | Yearly discounted (PKR 3,999 from 4,999) |
| Normalizer | `normalizeLandingCampaign` | `normalizeLanding2Campaign` |
| Offer notice | Standard daily/Rs.1 style copy | Explicit **20% off yearly** notice |

**Legacy redirects (preserve query):** `/landing`, `/mainLanding2` → `/mainLanding`.

### 2.2 Query contract

| Param | Meaning | Examples |
| --- | --- | --- |
| `utm` | Traffic source code | `D` direct, `T` TikTok, `M` Meta |
| `package` | Plan | `default` / `1` → monthly; `2` → yearly |
| `parameter` | Offer / partner label | `default`, `20percentoff`, partner name |
| `payment` | Rail | `jazzcash` |
| `he` (optional) | Jazz HE flag | `1` / `0` |

Missing params → **that landing’s** defaults.  
If `utm` is set and `utm_source` empty → copy `utm` → `utm_source` for billing attribution.

**Package → plan code:**

```text
default | 1 | monthly  → premium-monthly (599)
2 | yearly             → premium-yearly (4999; 3999 if parameter=20percentoff)
```

**Example URLs:**

```text
/mainLanding?utm=D&package=default&parameter=default&payment=jazzcash
/mainLanding?utm=M&package=default&parameter=Ranchers&payment=jazzcash
/landing2?utm=T&package=2&parameter=20percentoff&payment=jazzcash
```

### 2.3 Layout shell (same for both landings)

Content strings differ; **section order is shared**. Replace SkillUp copy with `{{LANDING_*_COPY}}` in the other project.

```text
<main>
  [LandingAnalyticsBoot]          // GA4 + funnel paywall_viewed

  ABOVE THE FOLD
  ├── Hero section
  │     ├── Visually-hidden H1 (SEO)
  │     └── Full-width banner image
  └── Subscribe / payment card     // see §2.4

  BELOW THE FOLD (scroll reveal)
  └── “What You Can Learn”
        ├── Section heading
        ├── Course grid (4 cards: icon + title + short line)
        ├── “… and much more” heading
        ├── Trust row (3 items: Secure Payments / Data safe / Support)
        └── Legal line (Terms + Privacy links)
</main>
```

| Block | Default vs TikTok difference |
| --- | --- |
| Banner image | Same asset unless product supplies a TikTok-specific creative |
| H1 | TikTok adds “20% off yearly” intent in hidden H1 / metadata |
| Subscribe card | TikTok passes `offerNotice`, `returnPath`, `landing="landing2"` |
| Course / trust / legal | Same structure; swap copy via placeholders |

**Metadata:** each landing builds a **canonical URL including campaign query**, indexable, Open Graph title/description.

### 2.4 Subscribe card fields (JazzCash entry — not sign-in)

| UI | Required | Notes |
| --- | --- | --- |
| Heading | — | “Enter Your JazzCash Number” |
| JazzCash MSISDN | Yes (unless staging bypass) | `03XXXXXXXXX`; digits only; stored in `sessionStorage` for later sign-in prefills |
| Terms checkbox | Yes | “I agree to … Terms and Conditions” |
| **Subscribe Now** | — | CTA |
| Offer notice | — | Default vs TikTok string |

**On Subscribe Now (guest path):**

1. Validate MSISDN + consent  
2. Stamp / refresh UTM attribution (`localStorage`, 30-day TTL)  
3. GA4 `add_to_cart` + `begin_checkout`  
4. Ops funnel `plan_selected` + `add_to_cart`  
5. `POST …/jazzcash-v11/link/start` with `{ planCode, msisdn, consentToAutoPay, idempotencyKey, attribution }`  
6. Auto-submit hosted form to JazzCash (`actionUrl` + `fields`)  

**Do not** redirect to sign-in on 401 for this path. Session is optional.

SkillUp sources:

| Concern | Path |
| --- | --- |
| Default page | `apps/web/app/mainLanding/page.tsx` |
| TikTok page | `apps/web/app/landing2/page.tsx` |
| Shared CSS / icons / scroll | `apps/web/app/mainLanding/*` |
| Subscribe card | `apps/web/app/mainLanding/landing-subscribe.tsx` |
| Campaign helpers | `apps/web/lib/landing-campaign.ts` |

---

## 3. JazzCash wallet-link flow (pay-first)

> **Merchant field values:** paste under `{{JAZZCASH_MERCHANT_DETAILS}}` when available. Algorithm and sequence below are fixed.

### 3.1 User-visible sequence

```text
1. Guest on landing enters JazzCash number + agrees to Terms
2. App API: POST /v1/premium/billing/jazzcash-v11/link/start
   - if browser has session → that userId
   - else → resolveOrCreatePhoneLearnerForCheckout(msisdn)  // user row, NO session cookie
3. API returns { actionUrl, fields } (signed LinkWallet form)
4. Browser POSTs to JazzCash LinkWallet portal
5. User completes OTP + MPIN **only on JazzCash** (never collect in your UI)
6. JazzCash returns to registered Return URL with pp_* fields
7. App: POST …/link/complete  (session still optional; ownership via pp_RequestID)
8. Backend: verify SecureHash → store payment token → PayViaToken → mark order succeeded → grant entitlement
9. Browser lands on success page / home with payment banner
10. Banner tells user to sign in with the **same** JazzCash number
11. Optional: IPN + Status Inquiry settle race-safely (idempotent)
```

### 3.2 Provider surface (SkillUp live orchestrator)

**Host:** `https://onlinepayments.jazzcash.com.pk`

| Capability | Who calls | Path (summary) |
| --- | --- | --- |
| LinkWallet | Browser form POST | `/payment-orchestrator/WalletLinkingPortal/wallet/LinkWallet` |
| PayViaToken | Your server | `/payment-orchestrator/api/v4/rest/payments/m-wallet` |
| Status Inquiry | Your server | `/payment-orchestrator/api/v2/rest/payments/status/inquiry` (**no** `pp_Version`) |
| Token Inquiry / Delete | Your server | mobile-tokens paths |
| Refund | Your server | configured refund URL |
| IPN | JazzCash → you | Public HTTPS (e.g. `/jazzcash/ipn` → API IPN) |

**Allowlist with JazzCash:** exact Return URL + IPN URL strings.

### 3.3 SecureHash (mandatory)

1. All non-empty `pp_*` except `pp_SecureHash`  
2. Sort field **names** by ASCII  
3. Message = `IntegritySalt&v1&v2&…&vN` (salt first, no trailing `&`)  
4. HMAC-SHA256 → uppercase hex → `pp_SecureHash`  

Never log Password, IntegritySalt, SecureHash, PaymentToken, OTP, MPIN.  
Never put merchant secrets in a static frontend bundle.

### 3.4 App API contract (mirror)

**Start (session optional):**

```http
POST /v1/premium/billing/jazzcash-v11/link/start
```

```json
{
  "planCode": "premium-monthly",
  "msisdn": "03123456789",
  "consentToAutoPay": true,
  "idempotencyKey": "optional-stable-key-12chars-min",
  "attribution": {
    "utm": "T",
    "package": "2",
    "parameter": "20percentoff",
    "landing": "landing2"
  }
}
```

**201:** `{ checkoutMode, requestId, actionUrl, fields }`

**Complete (session optional):**

```http
POST /v1/premium/billing/jazzcash-v11/link/complete
```

Body: `{ "fields": { "pp_*": "..." } }`  
Require success code + `pp_PaymentToken`; then PayViaToken + entitlement.

**Also:** IPN public ACK 200; Status Inquiry; optional admin refund from settled order only.

SkillUp sources: `apps/api/src/jazzcash-v11.ts`, `jazzcash-v11-billing.ts`, `apps/web/app/[locale]/account/payment-return/route.ts`, `apps/web/app/jazzcash/ipn/route.ts`.

---

## 4. Sign-up / Sign-in (after JazzCash)

### 4.1 Rule

There is **no separate Signup page**. One passwordless screen:

> **“Sign in or create account”**

Route: `/[locale]/sign-in`  
Same fields for new and returning users. No password.

After pay-first JazzCash, the learner should enter the **same mobile number** used on the landing. OTP creates a session on the phone-bound user that already holds Premium.

### 4.2 Screen A — Start

| Field | Required | Constraints |
| --- | --- | --- |
| Full name | Yes | 2–60 chars → sent as `displayName` on verify |
| Email or mobile number | Yes | One identity field; PK mobile or email |

CTA: **Continue** → `POST /api/v1/auth/otp/start` `{ identity }`

Prefill: if `sessionStorage` has landing MSISDN, identity field can start with that number.

### 4.3 Screen B — OTP

| Field | Required | Constraints |
| --- | --- | --- |
| Four-digit code | Yes | Exactly 4 digits |

Submit: `POST /api/v1/auth/otp/verify` `{ challengeId, code, displayName }`  
Also: Resend code; Use a different email or number.

### 4.4 After verify

- New identity → create user + attach identity + session  
- Existing phone (including pay-first checkout user) → session on that user  
- If onboarding incomplete → `/onboarding` (separate from auth fields)  
- Premium Features UI: gate behind **signed-in session** then entitlement  

**Alternate path:** signed-in email user later links the JazzCash phone → `mergePhoneCheckoutAccountIfNeeded` moves wallet links / orders / entitlements onto the signed-in account.

Staging fixed OTP (e.g. `1234`) only for allowlisted identities — never production-wide.

UI: `apps/web/app/[locale]/sign-in/sign-in-form.tsx`  
API: `apps/api/src/auth.ts`

---

## 5. UTM / attribution recording + analytics

Two layers. Do not mix them up.

### 5.A Official Subs attribution (source of truth for admin reports)

**Capture (client):**

- Key: `localStorage` `skillup_utm_attribution`  
- TTL: 30 days  
- Built from landing campaign + `landing` / `landingPath` / optional `he`  
- Helper: `attributionForBilling(campaign, { landing, landingPath })` on Subscribe Now  

**Allowlisted fields (clip ~80 chars; `landingPath` ~120):**

`utm`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `package`, `parameter`, `payment`, `ref`, `landing`, `landingPath`, `he`

**Persist (server) on billing:**

| Store | Purpose |
| --- | --- |
| `users.premium_attribution` | Last-touch on user |
| `jazzcash_wallet_link_intents.attribution` | Intent-time stamp |
| `payment_orders.attribution` | **Campaign Subs report source** |

Hygiene flag on payment attribution only: `omitFromCampaignReport: true` (hide from grid without deleting payment).

SkillUp: `apps/web/lib/utm-attribution.ts`, `apps/api/src/premium-attribution.ts`.

### 5.B GA4 marketing funnel (not finance)

Env: `GA_MEASUREMENT_ID` / `NEXT_PUBLIC_GA_MEASUREMENT_ID` → `{{GA_MEASUREMENT_ID}}`  
`gtag('config', id, { send_page_view: false })`. Never throw.

| When | Events |
| --- | --- |
| Land | `landing_view`, `view_item` |
| Subscribe Now | `add_to_cart`, `begin_checkout` |
| Payment return | `payment_result`; success → `subscribe` (monthly) or `purchase` (yearly), once per `transaction_id` |

Context in `sessionStorage` `lp_context`; dedupe `lp_sent_tokens`.  
`utm` → `traffic_source`: `M`→meta, `T`→tiktok, else direct.

### 5.C Ops funnel ingest (optional)

```http
POST /v1/premium/analytics/events
```

Allowlist: `paywall_viewed`, `plan_selected`, `add_to_cart` (auth optional).  
On payment success server also records commercial `subscribe` / `purchase` with attribution in properties — still **not** the official Subs ledger.

---

## 6. Admin panel — APIs and UI

### 6.1 UI entry

| Item | SkillUp value |
| --- | --- |
| Page | `{{ADMIN_BASE_PATH}}` → `/en/admin/premium` |
| Component | `apps/web/app/[locale]/admin/premium/premium-workspace.tsx` |
| Auth | Admin session / premium report capabilities |

**Tabs:**

| Tab id | Label | Role |
| --- | --- | --- |
| `summary` | Summary | High-level premium stats |
| `campaign` | **Campaign attribution** | Daily + Detailed Subs from payments |
| `payments` | Payments | Payment list |
| `memberships` | Memberships | Memberships + manual grant entry |
| `recurring` | Recurring customers | Recurring wallet customers |
| `reconciliation` | Reconciliation | Ops reconciliation |
| `plans` | Plans | Plan versions activate/retire |
| `exports` | Exports | Async export jobs + download |

Date filters (shared): `today`, `yesterday`, `last_7_days`, `last_30_days`, `current_month`, `previous_month`, `custom` (+ `from`/`to`), timezone **Asia/Karachi**. Aggregation `daily` | `monthly` where applicable. Tab state mirrored in URL `?tab=campaign&preset=…`.

### 6.2 Campaign attribution tab (what to build)

1. **Daily campaign report table** — per calendar day maps of platform / package / parameter → subscription counts (and amounts).  
2. **Detailed view** — `platform × parameter` and `package × parameter` tables.  
3. **Totals** in range.  
4. **Download** spreadsheet/CSV helpers (`campaign-attribution-xlsx.ts`, `campaign-attribution-csv.ts`).  
5. **Hygiene panel** — omit / restore succeeded payments from the campaign grid; list recent orders with omit flag.

### 6.3 Admin APIs (premium reports)

Base prefix: `/v1/admin/reports/premium/…`  
Web usually proxies as `/api/v1/admin/reports/premium/…`.

| Method | Path | Capability (SkillUp) | Purpose |
| --- | --- | --- | --- |
| GET | `/access` | — | What the operator can see |
| GET | `/summary` | `premium.report.read` | Summary |
| GET | `/payments` | read | Payments |
| GET | `/memberships` | read | Memberships |
| POST | `/memberships/manual-grants` | grant | Manual Premium grant |
| GET | `/recurring-customers` | read | Recurring |
| GET | `/reconciliation` | read | Reconciliation |
| GET | **`/campaign-attribution`** | read | **Official campaign Subs report** |
| GET | **`/campaign-attribution/orders`** | read | Recent succeeded orders (+ omitted filter) |
| POST | **`/campaign-attribution/hygiene`** | export | Omit / restore from campaign grid |
| GET | `/plans` | read | Plans |
| POST | `/plans/versions` | write | Create draft version |
| POST | `/plans/versions/:id/activate` | write | Activate |
| POST | `/plans/versions/:id/retire` | write | Retire |
| POST | `/exports` | export | Start export (`campaign_attribution` type supported) |
| GET | `/exports` | export | List exports |
| GET | `/exports/:id/download` | export | Download |

**Campaign attribution response shape (conceptual):**

- `reportSchemaVersion`: `premium-campaign-attribution.v1`  
- `timezone`, `effectiveRange`  
- `totals` — subscriptions + amount  
- `basic` — date × platform × package × parameter  
- `detailed.platformByParameter` / `detailed.packageByParameter`  
- `daily` — per-day breakdown  
- `exportRows` — flat rows for CSV/email  

**Filter rule:** `payment_orders.status = 'succeeded'`, `completed_at` in range, skip `omitFromCampaignReport`.

**Hygiene examples:**

```json
{
  "action": "omit",
  "reason": "QA traffic",
  "match": { "preset": "last_7_days", "platform": "D", "parameter": "default" }
}
```

```json
{
  "action": "restore",
  "reason": "Restore partner rows",
  "orderIds": ["<payment-order-uuid>"]
}
```

```http
GET /v1/admin/reports/premium/campaign-attribution/orders?preset=last_30_days&omitted=all&limit=50
```

### 6.4 Related ops (optional)

SkillUp also emails a **campaign daily report** (+ separate Logs email) on an Asia/Karachi schedule from the same attribution source. Mirror only if the other product needs email ops.

---

## 7. End-to-end checklist (other project)

### Landings

- [ ] `/mainLanding` (or product equivalent) with default UTM/package/parameter  
- [ ] `/landing2` TikTok landing with TikTok defaults + offer notice  
- [ ] Shared layout: hero → subscribe card → learn grid → trust → legal  
- [ ] Query normalizers + canonical metadata  
- [ ] Paste `{{LANDING_DEFAULT_COPY}}` / `{{LANDING_TIKTOK_COPY}}`

### JazzCash pay-first

- [ ] Guest `link/start` without session  
- [ ] Phone-bound user, no cookie until OTP  
- [ ] Hosted LinkWallet → return → `link/complete` → PayViaToken → entitlement  
- [ ] Success copy: sign in with **same** number  
- [ ] Paste `{{JAZZCASH_MERCHANT_DETAILS}}` into secrets / env only  

### Sign-in

- [ ] Single passwordless form: full name + identity → 4-digit OTP  
- [ ] Prefill MSISDN from landing storage when present  
- [ ] Premium gated on session + entitlement  

### Attribution + GA4

- [ ] Stamp attribution on `link/start`; store on payment order  
- [ ] Admin campaign report reads **payments**, not GA4  
- [ ] GA4 land → CTA → conversion funnel; `{{GA_MEASUREMENT_ID}}`  

### Admin

- [ ] Premium workspace with **Campaign attribution** tab (Daily + Detailed)  
- [ ] APIs: campaign-attribution + orders + hygiene + export  
- [ ] Date presets in Asia/Karachi  

---

## 8. SkillUp source map (authoritative)

| Concern | Path |
| --- | --- |
| Default landing | `apps/web/app/mainLanding/page.tsx` |
| TikTok landing | `apps/web/app/landing2/page.tsx` |
| Subscribe / guest start | `apps/web/app/mainLanding/landing-subscribe.tsx` |
| Campaign query helpers | `apps/web/lib/landing-campaign.ts` |
| UTM localStorage | `apps/web/lib/utm-attribution.ts` |
| GA4 + landing funnel | `apps/web/lib/ga4.ts`, `landing-analytics.ts` |
| Sign-in UI | `apps/web/app/[locale]/sign-in/sign-in-form.tsx` |
| Phone checkout + OTP + merge | `apps/api/src/auth.ts` |
| JazzCash hash / client | `apps/api/src/jazzcash-v11.ts` |
| JazzCash billing routes | `apps/api/src/jazzcash-v11-billing.ts` |
| Payment return | `apps/web/app/[locale]/account/payment-return/route.ts` |
| Success banner | `apps/web/app/[locale]/home-payment-banner.tsx` |
| Attribution sanitize | `apps/api/src/premium-attribution.ts` |
| Campaign report | `apps/api/src/premium-campaign-attribution-report.ts` |
| Admin report routes | `apps/api/src/premium-reporting-routes.ts` |
| Admin UI | `apps/web/app/[locale]/admin/premium/premium-workspace.tsx` |
| Landing URL cookbook | `docs/product/PREMIUM_CAMPAIGN_LANDING_URLS.md` |
| Analytics implementation notes | `docs/product/PREMIUM_CAMPAIGN_ANALYTICS_IMPLEMENTATION.md` |

---

**End of master handoff.**  
When the other chat provides JazzCash merchant details and landing copy, fill §0 and regenerate product-specific strings without changing the flow rules in §1–§6.
