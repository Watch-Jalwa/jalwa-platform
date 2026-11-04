import assert from "node:assert/strict";
import test from "node:test";

process.env.JAZZCASH_INTEGRITY_SALT ??= "testsalt";

const { buildJazzcashSecureHash, verifyJazzcashSecureHash } = await import("../lib/payments/jazzcash-v11.mjs");

test("JazzCash SecureHash sorts pp_* fields and uses integrity salt first", () => {
  const fields = {
    pp_Version: "1.1",
    pp_MerchantID: "MC123",
    pp_Password: "secret",
    pp_TxnRefNo: "JL1",
    pp_MobileNumber: "03001234567",
    pp_ReturnURL: "https://watch-jalwa.com/callback",
  };
  const hash = buildJazzcashSecureHash(fields, "testsalt");
  assert.match(hash, /^[A-F0-9]{64}$/);
  assert.equal(verifyJazzcashSecureHash({ ...fields, pp_SecureHash: hash }), true);
  assert.equal(verifyJazzcashSecureHash({ ...fields, pp_SecureHash: "DEADBEEF" }), false);
});
