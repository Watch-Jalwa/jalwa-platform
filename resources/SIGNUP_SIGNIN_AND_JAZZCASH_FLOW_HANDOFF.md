# Signup / Sign-in + JazzCash Wallet-Link Flow (portable handoff)

**Audience:** Another project implementing the same auth + JazzCash pattern  
**Source of truth in SkillUp:** `apps/api/src/auth.ts`, `apps/web/app/[locale]/sign-in/sign-in-form.tsx`, `apps/api/src/jazzcash-v11.ts`, `apps/api/src/jazzcash-v11-billing.ts`  
**Do not invent a different JazzCash protocol.** Match the SecureHash rules below exactly — most `pp_SecureHash` / “invalid secure hash” failures after the MSISDN step come from hashing mistakes, not JazzCash downtime.

---

## 0. Product rules (do not re-debate)

1. **Pay-first:** Landing checkout does **not** require sign-in. Guest enters JazzCash MSISDN → phone-bound user (no session) → JazzCash LinkWallet → later sign-in with the **same** number unlocks Premium.
2. **Learner auth UI today:** mobile + password (not OTP in the learner form). OTP endpoints still exist on the API for identity linking / legacy.
3. **MPIN / JazzCash OTP:** Never collected in your UI. Only on JazzCash’s hosted portal.
4. **SecureHash:** Server-side only. Never trust a client-computed hash.

---

## 1. Signup / sign-in flow

### 1.1 Learner routes (web)

| Page | Purpose |
| --- | --- |
| `/[locale]/sign-up` | Create account |
| `/[locale]/sign-in` | Returning learner |

Both use the same form component and the **same API**:

```http
POST /v1/auth/password/login
Content-Type: application/json
```

One endpoint handles **register** and **sign-in**. Behavior is decided by whether the phone already exists and whether `displayName` is present.

### 1.2 Request fields (learner password)

| Field | Sign-up | Sign-in | Rules |
| --- | --- | --- | --- |
| `displayName` | **Required** | Optional | Trimmed string, length **2–60**. Required when creating a new account (“Enter your full name to create an account.”). |
| `phone` | Required | Required | Pakistani mobile; length **10–20** raw input. Normalized server-side to `+923XXXXXXXXX`. |
| `password` | Required | Required | Length **7–128**. Must include **upper**, **lower**, **digit**, and **symbol** (non-alphanumeric). |

Example sign-up body:

```json
{
  "displayName": "Ali Khan",
  "phone": "03001234567",
  "password": "Abc@1234"
}
```

Example sign-in body:

```json
{
  "phone": "03001234567",
  "password": "Abc@1234"
}
```

Success (`200`): sets `HttpOnly` session cookie; body `{ "learner": { ... } }`.

### 1.3 Phone normalization (auth)

Accepted inputs → stored as `+923XXXXXXXXX` (JazzCash display form is `03XXXXXXXXX`):

| Input examples | Normalized |
| --- | --- |
| `0300 1234567`, `03001234567` | `+923001234567` |
| `+923001234567` | `+923001234567` |
| `923001234567` | `+923001234567` |
| `00923001234567` | `+923001234567` |
| `3001234567` | `+923001234567` |

Reject anything that is not a Pakistan mobile starting with network digit `3` after country code (must match `^\+923\d{9}$` after normalize).

### 1.4 Password rules (copy into other project)

```text
length >= 7 and <= 128
has [a-z]
has [A-Z]
has [0-9]
has [^A-Za-z0-9]
```

Confirm-password is **UI-only** (not sent to API). Compare on the client before calling login.

### 1.5 Admin sign-in (separate)

```http
POST /v1/auth/admin/password/login
```

| Field | Rules |
| --- | --- |
| `email` | Valid email, max 254 |
| `password` | Length 8–128 |

Requires an active admin principal + stored credential. Do not reuse learner mobile login for operators.

### 1.6 OTP endpoints (still on API; not primary learner UI)

| Endpoint | Body fields |
| --- | --- |
| `POST /v1/auth/otp/start` | `identity` (email **or** phone string, 3–254) |
| `POST /v1/auth/otp/verify` | `challengeId` (UUID), `code` (**4 digits**), optional `displayName` (2–60) |
| `POST /v1/auth/email/start` | `email` |
| `POST /v1/auth/email/verify` | same as otp/verify |

Staging/local may use fixed phone OTP `1234` for allowlisted numbers only — **never** as a production-wide bypass.

### 1.7 Session / profile extras

| Endpoint | Notes |
| --- | --- |
| `GET /v1/auth/session` | Current learner |
| `POST /v1/auth/logout` | Revoke + clear cookie |
| `PATCH /v1/profile` | `displayName`, `locale` (`en`\|`ur`), `ageBand`, `avatarKey`, `learningGoal`, `onboardingStatus` |

### 1.8 Pay-first ↔ auth linking

```text
Landing MSISDN (guest)
  → resolveOrCreatePhoneLearnerForCheckout(msisdn)   // user row + phone identity, NO session
  → JazzCash LinkWallet / PayViaToken / entitlement on that userId
Later: POST /v1/auth/password/login with SAME phone
  → session on that user → Premium already present
If a signed-in account later verifies that phone:
  → mergePhoneCheckoutAccountIfNeeded (moves wallet links / orders / entitlements)
```

---

## 2. JazzCash flow (LinkWallet → return → PayViaToken)

### 2.1 High-level sequence

```text
Client (session optional)
  POST /v1/premium/billing/jazzcash-v11/link/start
    body: { planCode, msisdn, consentToAutoPay: true, idempotencyKey?, attribution? }
  ← { actionUrl, fields }   // signed LinkWallet form; includes pp_SecureHash

Browser auto-POSTs hidden form to JazzCash LinkWallet URL
  User enters OTP / MPIN on JazzCash UI

JazzCash redirects/POSTs to merchant Return URL with pp_* fields (+ pp_PaymentToken on success)

Client/server
  POST /v1/premium/billing/jazzcash-v11/link/complete
    body: { fields: { ...all JazzCash return pp_* ... } }
  Server verifies SecureHash → stores token → PayViaToken → entitlement
```

Provider host:

```text
https://onlinepayments.jazzcash.com.pk
```

| Step | Method | Path |
| --- | --- | --- |
| LinkWallet portal | Browser `POST` form (`application/x-www-form-urlencoded`) | `/payment-orchestrator/WalletLinkingPortal/wallet/LinkWallet` |
| Pay via Token | Server `POST` JSON | `/payment-orchestrator/api/v4/rest/payments/m-wallet` |
| Status Inquiry | Server `POST` JSON | `/payment-orchestrator/api/v2/rest/payments/status/inquiry` |
| Token Inquiry | Server `POST` JSON | `/payment-orchestrator/payment/api/v1/mobile-tokens/inquiry` |
| Token Delete | Server `POST` JSON | `/payment-orchestrator/payment/api/v1/mobile-tokens/delete` |
| IPN | JazzCash → your public URL | Merchant-configured |

### 2.2 `link/start` request fields (your API)

| Field | Required | Rules |
| --- | --- | --- |
| `planCode` | Yes | `premium-monthly` \| `premium-yearly` (adapt plan codes in other product) |
| `msisdn` | Yes | Digits only, **11–15** length (`/^\d{11,15}$/`). Landing UI strips non-digits; typical value `03XXXXXXXXX` (11 digits). |
| `consentToAutoPay` | Yes | Must be literal `true` |
| `idempotencyKey` | No | 12–128 chars; generate per attempt if omitted |
| `attribution` | No | Campaign/UTM object (product-specific) |

**Important MSISDN difference:**

- Auth stores phones as `+923…`
- JazzCash LinkWallet `pp_MSISDN` is sent as the **digits** the client posted (e.g. `03123456789`), **not** `+92…`

Do not hash one format and POST another.

### 2.3 LinkWallet form fields JazzCash expects

Built server-side:

| Field | Source |
| --- | --- |
| `pp_MerchantID` | Merchant ID from JazzCash |
| `pp_Password` | Merchant API password |
| `pp_MSISDN` | Digits from `link/start` |
| `pp_RequestID` | Unique intent id (e.g. `ReqId` + timestamp + hex) |
| `pp_ReturnURL` | Exact allowlisted HTTPS return URL |
| `pp_SecureHash` | HMAC of the fields above |

Then browser POSTs those hidden inputs to `actionUrl` (LinkWallet).

### 2.4 PayViaToken fields (server JSON after return)

| Field | Notes |
| --- | --- |
| `pp_MerchantID` | |
| `pp_Password` | |
| `pp_PaymentToken` | From JazzCash return |
| `pp_TxnRefNo` | Merchant reference (SkillUp uses `Goo` + PKT stamp + 2 hex ≤ 20 chars) |
| `pp_Amount` | Minor units as string (e.g. `"59900"` for PKR 599.00 if using paisa — match your merchant amount convention) |
| `pp_BillReference` | |
| `pp_Description` | |
| `pp_TxnCurrency` | `PKR` |
| `pp_TxnDateTime` | `yyyyMMddHHmmss` Asia/Karachi |
| `pp_TxnExpiryDateTime` | |
| `pp_SecureHash` | |

**Do not** send `pp_MPIN` / `pp_CNIC` / learner password on PayViaToken for this DOC flow.

### 2.5 Status Inquiry fields (common hash footgun)

Only these four (plus computed hash):

```text
pp_MerchantID
pp_Password
pp_TxnRefNo
pp_SecureHash
```

**Do not include `pp_Version`.** Including it changes the HMAC input and JazzCash returns invalid `pp_SecureHash` (response code **110** in SkillUp notes).

---

## 3. `pp_SecureHash` — implement exactly (fix the other project’s error)

### 3.1 Algorithm (2026 MWallet DOC / SkillUp V11)

```text
1. Take all fields whose names start with "pp_" EXCEPT "pp_SecureHash"
2. Drop empty / whitespace-only values (trim before emptiness check)
3. Sort by field NAME ascending using ASCII byte order
   - Use plain string compare: (a < b ? -1 : a > b ? 1 : 0)
   - Do NOT use localeCompare / Intl sort
4. Message = IntegritySalt + "&" + value1 + "&" + value2 + ... + valueN
   - Salt FIRST
   - NO trailing "&"
5. HMAC-SHA256(message, key = IntegritySalt), encoding UTF-8
6. Hex digest, UPPERCASE → pp_SecureHash
```

### 3.2 Node.js reference (copy/paste)

```js
import { createHmac } from "node:crypto";

export function jazzCashV11SecureHash(fields, integritySalt) {
  const values = Object.entries(fields)
    .filter(
      ([key, value]) =>
        key !== "pp_SecureHash" &&
        key.startsWith("pp_") &&
        String(value).trim().length > 0,
    )
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([, value]) => String(value).trim());

  const message = [integritySalt, ...values].join("&");
  return createHmac("sha256", integritySalt)
    .update(message, "utf8")
    .digest("hex")
    .toUpperCase();
}
```

### 3.3 Worked LinkWallet example

Fields before hash:

```text
pp_MerchantID   = MC990984
pp_Password     = <merchant password>
pp_MSISDN       = 03123456789
pp_RequestID    = ReqId123
pp_ReturnURL    = https://your-host.example/en/account/payment-return
```

ASCII name order:

```text
pp_MSISDN, pp_MerchantID, pp_Password, pp_RequestID, pp_ReturnURL
```

Message:

```text
<IntegritySalt>&03123456789&MC990984&<password>&ReqId123&https://your-host.example/en/account/payment-return
```

Then HMAC-SHA256 → uppercase hex → `pp_SecureHash`.

### 3.4 Checklist when JazzCash says invalid SecureHash after number entry

This almost always means **the LinkWallet form your server signed was wrong**, not the user’s MPIN.

| Check | Wrong → symptom |
| --- | --- |
| Integrity Salt | Typo / staging vs live salt / trailing space / wrong env |
| MerchantID / Password | Mismatch with salt pair JazzCash issued |
| Extra fields in hash set | e.g. `pp_Version`, empty strings, custom fields |
| Missing fields | Hash computed without `pp_Password` then field added later (or reverse) |
| Sort | `localeCompare` / sorting by **values** instead of **names** |
| Case | Lowercase hex when JazzCash expects **UPPERCASE** (V11 orchestrator) |
| Trim | Hashing untrimmed values while posting trimmed (or vice versa) |
| MSISDN format | Hashing `+923…` but posting `03…` (or spaces/dashes left in) |
| Return URL | Must be exact string JazzCash allowlisted; also included in hash |
| Client re-hash | Frontend must POST server-returned fields **verbatim** — do not recompute hash in browser |
| Charset | Form `accept-charset=UTF-8`; HMAC message UTF-8 |

### 3.5 Verify incoming JazzCash callbacks

Recompute hash from returned `pp_*` (excluding `pp_SecureHash`) with the same algorithm; constant-time compare to provided hash. Reject on mismatch before granting entitlement.

---

## 4. Env / JazzCash config the other project must fill

| Config | Purpose |
| --- | --- |
| Merchant ID | `pp_MerchantID` |
| Password | `pp_Password` |
| Integrity Salt | HMAC key |
| LinkWallet URL | Form `action` |
| PayViaToken URL | Server charge |
| Status / Token inquiry / delete URLs | Lifecycle |
| Return URL | Exact allowlisted HTTPS path |
| IPN URL | Public notification (if enabled) |

Never commit secrets. Return URL mismatch often looks like “site can’t be reached” after OTP even when linking succeeded; hash mismatch looks like invalid `pp_SecureHash` earlier.

---

## 5. Frontend handoff notes

1. Call `link/start` → receive `actionUrl` + `fields`.
2. Build a hidden `<form method="POST" accept-charset="UTF-8">`, one hidden input per field, `form.submit()` synchronously.
3. Do not strip, reorder for display, or re-sign fields.
4. On return page, forward **all** JazzCash `pp_*` fields to `link/complete` as `{ fields: { ... } }`.
5. Session cookie may be missing on JazzCash cross-site return; ownership is proven by signed `pp_RequestID` → stored intent.

Landing MSISDN validation used in SkillUp web: `/^\d{11,15}$/` after stripping non-digits.

---

## 6. Suggested implementation order (other project)

1. Port SecureHash helper + unit test against a known field set.
2. LinkWallet start (signed form) → manual JazzCash sandbox test with real MSISDN.
3. Return URL → verify hash → store token → PayViaToken.
4. Status Inquiry **without** `pp_Version`.
5. Learner signup/signin (`displayName` + `phone` + `password`) and pay-first phone user binding.
6. Merge path if a signed-in user later claims the checkout phone.

---

## 7. SkillUp source map (if you need to re-check)

| Concern | Path |
| --- | --- |
| Auth schemas + normalize + password login | `apps/api/src/auth.ts` |
| Learner password strength | `apps/api/src/learner-password.ts` |
| Sign-in / sign-up UI | `apps/web/app/[locale]/sign-in/sign-in-form.tsx` |
| SecureHash + LinkWallet / PayViaToken builders | `apps/api/src/jazzcash-v11.ts` |
| Billing start/complete | `apps/api/src/jazzcash-v11-billing.ts` |
| Landing guest checkout | `apps/web/app/mainLanding/landing-subscribe.tsx` |
| Form POST helper | `apps/web/lib/jazzcash-checkout.ts` |
| Longer JazzCash guide | `docs/payments/JAZZCASH_MWALLET_RECURRING_INTEGRATION_GUIDE.md` |

---

End of handoff.
