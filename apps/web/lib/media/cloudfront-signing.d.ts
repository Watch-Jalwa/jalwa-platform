export function createCloudFrontSignedCookies(input: {
  resource: string;
  keyPairId: string;
  privateKey: string;
  expiresAt: Date | string;
}): Record<"CloudFront-Key-Pair-Id" | "CloudFront-Policy" | "CloudFront-Signature", string>;
