import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  resolveDigisphereOrderId,
  fireDigisphereSubscribeFromReturn,
  saveDigispherePendingCheckout,
  readDigispherePendingCheckout,
  clearDigispherePendingCheckout,
  DIGISPHERE_PENDING_KEY,
} = await import("../lib/digisphere-subscribe-conversion.mjs");

const {
  __resetTikTokPixelForTests,
  wasTikTokConversionFired,
  JALWA_TIKTOK_PIXEL_META,
} = await import("../lib/tiktok-pixel.mjs");

function installMockDom() {
  const store = new Map();
  const scripts = [];
  const headChildren = [];
  const document = {
    head: {
      appendChild(node) {
        headChildren.push(node);
        return node;
      },
    },
    createElement() {
      return {
        type: "",
        async: false,
        src: "",
        dataset: {},
        parentNode: null,
        name: "",
        content: "",
        getAttribute(key) {
          if (key === "content") return this.content;
          return null;
        },
        setAttribute() {},
      };
    },
    querySelector(sel) {
      if (String(sel).includes(JALWA_TIKTOK_PIXEL_META)) {
        return { getAttribute: () => "DBU5R83C77UCDH70PUCG" };
      }
      return null;
    },
    getElementsByTagName(tag) {
      if (tag === "script") return { 0: scripts[0], length: scripts.length };
      return { length: 0 };
    },
  };
  globalThis.document = document;
  globalThis.window = {
    document,
    ttq: {
      methods: ["page", "track", "load"],
      load() {},
      page() {},
      track() {},
      _jalwaReady: true,
    },
  };
  globalThis.sessionStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
  globalThis.localStorage = globalThis.sessionStorage;
}

test("Digisphere order id prefers URL then pending requestId then synthesized user+trial", () => {
  assert.equal(resolveDigisphereOrderId({ order: "txn-1" }, { requestId: "req-9" }), "txn-1");
  assert.equal(resolveDigisphereOrderId({}, { requestId: "req-9" }), "req-9");
  assert.equal(
    resolveDigisphereOrderId({ userId: "user-a", trialEndsAt: "2026-12-01T00:00:00.000Z" }, null),
    "digisphere:user-a:2026-12-01T00:00:00.000Z",
  );
  assert.equal(resolveDigisphereOrderId({}, null), "");
});

test("wallet=linked fires Subscribe once without DIY cv receipt", () => {
  installMockDom();
  __resetTikTokPixelForTests();
  // Re-install stub after reset
  globalThis.window.ttq = {
    methods: ["page", "track", "load"],
    load() {},
    page() {},
    track() {},
    _jalwaReady: true,
  };
  clearDigispherePendingCheckout();
  saveDigispherePendingCheckout({
    requestId: "digi-req-42",
    checkoutMode: "payment-service",
    planCode: "premium-monthly-pkr",
    landing: "landing1",
    utm: "T",
  });
  assert.equal(readDigispherePendingCheckout()?.requestId, "digi-req-42");

  const first = fireDigisphereSubscribeFromReturn({
    wallet: "linked",
    userId: "user-a",
    subscriptionStatus: "trialing",
  });
  assert.equal(first.fired, true);
  assert.equal(first.orderId, "digi-req-42");
  assert.equal(wasTikTokConversionFired("Subscribe", "digi-req-42"), true);
  assert.equal(sessionStorage.getItem(DIGISPHERE_PENDING_KEY), null);
});

test("non-linked Digisphere return does not fire Subscribe", () => {
  installMockDom();
  __resetTikTokPixelForTests();
  globalThis.window.ttq = {
    methods: ["page", "track", "load"],
    load() {},
    page() {},
    track() {},
    _jalwaReady: true,
  };
  saveDigispherePendingCheckout({ requestId: "digi-req-99", planCode: "premium-monthly-pkr" });
  const result = fireDigisphereSubscribeFromReturn({ wallet: "failed" });
  assert.equal(result.fired, false);
  assert.equal(result.reason, "not_linked");
});

test("landing and wallet-return wire Digisphere pending checkout + Subscribe", async () => {
  const root = new URL("../../../", import.meta.url);
  const read = (path) => readFile(new URL(path, root), "utf8");
  const landing = await read("apps/web/app/landing/landing-subscribe.tsx");
  const poller = await read("apps/web/components/payment-status-poller.tsx");
  const wallet = await read("apps/web/components/wallet-subscribe.tsx");
  assert.match(landing, /saveDigispherePendingCheckout/);
  assert.match(wallet, /saveDigispherePendingCheckout/);
  assert.match(poller, /fireDigisphereSubscribeFromReturn/);
  assert.match(poller, /guest_ready/);
});
