import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isFrontendPreview } from "@/lib/runtime";
import { createOtpChallengeId, readOtpChallengeId } from "./otp-challenge.mjs";
import { maskIdentity, parseIdentity, validateDisplayName } from "./identity.mjs";

export type IdentityChannel = "email" | "phone";

export type OtpStartResult =
  | { ok: true; challengeId: string; channel: IdentityChannel; maskedDestination: string; expiresAt: string; preview?: boolean }
  | { ok: false; error: string; status: number };

export type OtpVerifyResult =
  | { ok: true; next: string }
  | { ok: false; error: string; status: number };

function toE164(phone: string) {
  if (phone.startsWith("+92")) return phone;
  if (phone.startsWith("03") && phone.length === 11) return `+92${phone.slice(1)}`;
  return phone;
}

export async function startOtp(identityRaw: string): Promise<OtpStartResult> {
  const parsed = parseIdentity(identityRaw);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };

  const { challengeId, expiresAt } = createOtpChallengeId(parsed.channel, parsed.normalized);
  const maskedDestination = maskIdentity(parsed.channel, parsed.normalized);

  if (isFrontendPreview()) {
    return { ok: true, challengeId, channel: parsed.channel, maskedDestination, expiresAt, preview: true };
  }

  if (parsed.channel === "email") {
    try {
      await auth.api.sendVerificationOTP({
        body: { email: parsed.normalized, type: "sign-in" },
        headers: await headers(),
      });
    } catch {
      return { ok: false, error: "send-failed", status: 502 };
    }
    return { ok: true, challengeId, channel: "email", maskedDestination, expiresAt };
  }

  try {
    await auth.api.sendPhoneNumberOTP({
      body: { phoneNumber: toE164(parsed.normalized) },
      headers: await headers(),
    });
  } catch {
    return { ok: false, error: "send-failed", status: 502 };
  }
  return { ok: true, challengeId, channel: "phone", maskedDestination, expiresAt };
}

export async function verifyOtp(input: {
  challengeId: string;
  code: string;
  displayName?: string;
  next?: string;
}): Promise<OtpVerifyResult> {
  const challenge = readOtpChallengeId(input.challengeId);
  if (!challenge) return { ok: false, error: "invalid-challenge", status: 400 };

  const code = String(input.code ?? "").trim();
  if (!/^\d{4}$/.test(code)) return { ok: false, error: "invalid-code", status: 400 };

  const displayName = validateDisplayName(String(input.displayName ?? ""));
  if (!displayName) return { ok: false, error: "invalid-name", status: 400 };

  if (isFrontendPreview()) return { ok: true, next: input.next ?? "/onboarding" };

  try {
    if (challenge.channel === "phone") {
      await auth.api.verifyPhoneNumber({
        body: {
          phoneNumber: toE164(challenge.identity),
          code,
          name: displayName,
        },
        headers: await headers(),
      });
    } else {
      await auth.api.signInEmailOTP({
        body: { email: challenge.identity, otp: code, name: displayName },
        headers: await headers(),
      });
    }
  } catch {
    return { ok: false, error: "invalid-code", status: 401 };
  }

  return { ok: true, next: input.next ?? "/onboarding" };
}
