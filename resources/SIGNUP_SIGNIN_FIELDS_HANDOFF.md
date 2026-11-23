# Handoff: Signup / Sign-in fields only

**Audience:** Another project copying SkillUp’s auth UI fields  
**Scope:** Learner signup + sign-in screens and fields only  
**Out of scope:** JazzCash, payments, pay-first checkout, onboarding profile fields, admin password login

---

## 1. Important product rule

SkillUp does **not** have separate Signup and Sign-in pages.

There is **one** passwordless screen:

> **“Sign in or create account”**

- Same fields for new and returning users
- No password
- First successful OTP creates the account; next time the same identity signs in

Route: `/[locale]/sign-in`  
UI source: `apps/web/app/[locale]/sign-in/sign-in-form.tsx`

---

## 2. Screen A — Start (before OTP)

Shown when there is no active challenge yet.

| Field (UI label) | Form name / state | Required | Type / constraints | Notes |
| --- | --- | --- | --- | --- |
| **Full name** | `fullName` | Yes | text, min 2, max 60 | Client validates before calling start API. Sent later as `displayName` on verify. |
| **Email or mobile number** | `identity` | Yes | text, max 254 | One field for either email **or** Pakistani mobile. Placeholder: `0300 1234567 or you@example.com` |

**Primary CTA:** `Continue` → starts OTP (`POST /api/v1/auth/otp/start` with `{ identity }`)

**Help text under identity:** Pakistan mobile formats such as `0300 1234567` and `+923001234567` are accepted.

**Not shown on this screen:**

- Password / confirm password
- Separate email vs phone toggle (auto-detected from input)
- Terms checkbox (not on this form)
- OTP code (that is Screen B)

---

## 3. Screen B — Verify code (after OTP sent)

Shown after a successful start. Heading: **“Enter your code”**

| Field (UI label) | Form name / state | Required | Type / constraints | Notes |
| --- | --- | --- | --- | --- |
| **Four-digit code** | `code` | Yes | numeric, exactly 4 digits | `inputMode="numeric"`, `autoComplete="one-time-code"`, pattern `[0-9]{4}` |

**Also submitted (not re-entered on this screen):**

| API field | Source | Notes |
| --- | --- | --- |
| `challengeId` | From start response | Hidden; not a visible field |
| `displayName` | Same `fullName` from Screen A | Trimmed; min 2 / max 60 when sent |

**Actions:**

| Control | Behavior |
| --- | --- |
| **Verify and continue** | `POST /api/v1/auth/otp/verify` with `{ challengeId, code, displayName }` |
| **Resend code** | Calls start again with the same `identity` |
| **Use a different email or number** | Clears challenge and returns to Screen A |

**Help text:** Code expires shortly and stops working after five unsuccessful attempts.

---

## 4. What counts as “signup” vs “signin”

| Concept | In SkillUp |
| --- | --- |
| Signup fields | Same as Screen A + Screen B |
| Signin fields | Same as Screen A + Screen B |
| Difference | Server: if identity is new → create user + attach identity; if existing → open session. UI does **not** branch. |
| Password | None for learners |

So for the other project, if you need two labeled flows, **reuse the same field list** for both.

---

## 5. API payloads (field contract only)

### Start OTP

```http
POST /api/v1/auth/otp/start
```

```json
{ "identity": "03001234567" }
```

or

```json
{ "identity": "you@example.com" }
```

Success returns (example shape):

```json
{
  "challengeId": "<uuid>",
  "channel": "phone",
  "maskedDestination": "...",
  "expiresAt": "..."
}
```

`channel` is `"email"` or `"phone"`.

### Verify OTP

```http
POST /api/v1/auth/otp/verify
```

```json
{
  "challengeId": "<uuid>",
  "code": "1234",
  "displayName": "Ali Khan"
}
```

`displayName` is optional on the API schema, but the SkillUp **UI always requires Full name** before start and always sends it on verify.

---

## 6. Field checklist (copy into the other project)

### Signup / Sign-in start form

- [ ] Full name (required, 2–60)
- [ ] Email or mobile number (required, one combined identity field)
- [ ] Continue → send OTP
- [ ] No password field

### OTP verify form

- [ ] Four-digit code (required)
- [ ] Verify and continue
- [ ] Resend code
- [ ] Change email/number (back to start)

---

## 7. Explicit exclusions (do not pull into this handoff)

- JazzCash MSISDN / wallet / pay-first flows
- Landing Subscribe Now payment fields
- Post-auth **onboarding** profile fields (age band, avatar, learning goal, locale) — those are a separate screen after first sign-in
- Admin email + password login
- Identity linking from account settings
