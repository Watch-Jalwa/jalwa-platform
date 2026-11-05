import assert from "node:assert/strict";
import test from "node:test";

process.env.JAZZCASH_INTEGRITY_SALT ??= "testsalt";
process.env.JAZZCASH_MERCHANT_ID ??= "MC990986";
process.env.JAZZCASH_PASSWORD ??= "test-password";
process.env.JAZZCASH_RETURN_URL ??= "https://watch-jalwa.com/callback";

const {
  buildJazzcashSecureHash,
  verifyJazzcashSecureHash,
  buildLinkWalletForm,
  jazzcashOfficialTestVectorHash,
} = await import("../lib/payments/jazzcash-v11.mjs");

test("JazzCash SecureHash matches official sample vector", () => {
  // Documented JazzCash sample: salt first, sorted values Amount/MerchantID/Password
  const hash = jazzcashOfficialTestVectorHash();
  assert.match(hash, /^[A-F0-9]{64}$/);
  // Known digest for salt 0F5DD14AE2 & 2995 & MER123 & A48cvE28
  assert.equal(
    buildJazzcashSecureHash(
      { pp_Amount: "2995", pp_MerchantID: "MER123", pp_Password: "A48cvE28" },
      "0F5DD14AE2",
    ),
    hash,
  );
});

test("JazzCash SecureHash sorts pp_* names and trims values", () => {
  const fields = {
    pp_ReturnURL: " https://example.com/callback ",
    pp_MSISDN: "03123456789",
    pp_MerchantID: "MC990986",
    pp_Password: "secret",
    pp_RequestID: "ReqId123",
  };
  const hash = buildJazzcashSecureHash(fields, "testsalt");
  assert.match(hash, /^[A-F0-9]{64}$/);
  assert.equal(
    hash,
    buildJazzcashSecureHash(
      {
        pp_MSISDN: "03123456789",
        pp_MerchantID: "MC990986",
        pp_Password: "secret",
        pp_RequestID: "ReqId123",
        pp_ReturnURL: "https://example.com/callback",
      },
      "testsalt",
    ),
  );
  assert.equal(verifyJazzcashSecureHash({ ...fields, pp_SecureHash: hash }), true);
  assert.equal(verifyJazzcashSecureHash({ ...fields, pp_SecureHash: "DEADBEEF" }), false);
});

test("LinkWallet form uses SkillUp V11 fields only", () => {
  const form = buildLinkWalletForm({ requestId: "ReqIdabc123", msisdn: "03001234567" });
  assert.equal(form.actionUrl.includes("/WalletLinkingPortal/wallet/LinkWallet"), true);
  assert.deepEqual(Object.keys(form.fields).sort(), [
    "pp_MSISDN",
    "pp_MerchantID",
    "pp_Password",
    "pp_RequestID",
    "pp_ReturnURL",
    "pp_SecureHash",
  ].sort());
  assert.equal(form.fields.pp_MSISDN, "03001234567");
  assert.equal(form.fields.pp_RequestID, "ReqIdabc123");
  assert.equal(form.fields.pp_MobileNumber, undefined);
  assert.equal(form.fields.pp_TxnRefNo, undefined);
  assert.equal(form.fields.pp_Version, undefined);
  assert.match(form.fields.pp_SecureHash, /^[A-F0-9]{64}$/);
});
