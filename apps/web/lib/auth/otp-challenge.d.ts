import type { IdentityChannel } from "./identity";

export type OtpChallengePayload = {
  v: 1;
  channel: IdentityChannel;
  identity: string;
  exp: number;
};

export function createOtpChallengeId(
  channel: IdentityChannel,
  identity: string,
  ttlSeconds?: number,
): { challengeId: string; expiresAt: string };

export function readOtpChallengeId(challengeId: string): OtpChallengePayload | null;
