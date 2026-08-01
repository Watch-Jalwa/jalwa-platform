export type CloudFrontSignedCookieInput = {
  resource: string;
  keyPairId: string;
  privateKey: string;
  expiresAt: Date | string | number;
};

export type CloudFrontSignedCookies = {
  "CloudFront-Key-Pair-Id": string;
  "CloudFront-Policy": string;
  "CloudFront-Signature": string;
};

export function createCloudFrontSignedCookies(input: CloudFrontSignedCookieInput): CloudFrontSignedCookies;
