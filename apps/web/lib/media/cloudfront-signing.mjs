import { createSign } from "node:crypto";

function cloudFrontBase64(value) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("=", "_")
    .replaceAll("/", "~");
}

function normalizedPrivateKey(value) {
  return value.includes("\\n") ? value.replaceAll("\\n", "\n") : value;
}

export function createCloudFrontSignedCookies({
  resource,
  keyPairId,
  privateKey,
  expiresAt,
}) {
  if (!resource || !keyPairId || !privateKey) throw new Error("CloudFront signing configuration is incomplete.");
  const epoch = Math.floor(new Date(expiresAt).getTime() / 1000);
  if (!Number.isFinite(epoch) || epoch <= Math.floor(Date.now() / 1000)) throw new Error("CloudFront cookie expiry must be in the future.");
  const policy = JSON.stringify({
    Statement: [{
      Resource: resource,
      Condition: { DateLessThan: { "AWS:EpochTime": epoch } },
    }],
  });
  const signer = createSign("RSA-SHA1");
  signer.update(policy);
  signer.end();
  const signature = signer.sign(normalizedPrivateKey(privateKey));
  return {
    "CloudFront-Key-Pair-Id": keyPairId,
    "CloudFront-Policy": cloudFrontBase64(policy),
    "CloudFront-Signature": cloudFrontBase64(signature),
  };
}
