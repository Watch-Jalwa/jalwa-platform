import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  resolveTikTokPixelId,
  ensureTikTokPixel,
  logTikTokEvent,
  wasTikTokConversionFired,
  __resetTikTokPixelForTests,
  JALWA_TIKTOK_PIXEL_DEFAULT,
  JALWA_TIKTOK_PIXEL_META,
} = await import("../lib/tiktok-pixel.mjs");

const {
  trackLandingView,
  trackLandingCheckoutIntent,
  trackLandingPaymentSuccess,
  landingOfferValuePkr,
} = await import("../lib/landing-analytics.mjs");

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
    createElement(tag) {
      const node = {
        tagName: String(tag).toUpperCase(),
        type: "",
        async: false,
        src: "",
        dataset: {},
        parentNode: null,
        name: "",
        content: "",
        getAttribute(key) {
          if (key === "content") return this.content;
          if (key === "name") return this.name;
          return null;
        },
        setAttribute(key, value) {
          if (key === "content") this.content = value;
          if (key === "name") this.name = value;
        },
      };
      return node;
    },
    querySelector(sel) {
      if (sel.startsWith(`meta[name="${JALWA_TIKTOK_PIXEL_META}"]`)) {
        return headChildren.find((n) => n.name === JALWA_TIKTOK_PIXEL_META) ?? null;
      }
      const match = /script\[data-jalwa-tiktok-pixel="([^"]+)"\]/.exec(sel);
      if (match) return scripts.find((s) => s.dataset.jalwaTiktokPixel === match[1]) ?? null;
      return null;
    },
    querySelectorAll(sel) {
      const match = /script\[data-jalwa-tiktok-pixel="([^"]+)"\]/.exec(sel);
      if (match) return scripts.filter((s) => s.dataset.jalwaTiktokPixel === match[1]);
      return [];
    },
    getElementsByTagName(tag) {
      if (tag === "script") {
        return {
          0: scripts[0],
          length: scripts.length,
        };
      }
      return { length: 0 };
    },
  };

  // When load() inserts before first script, capture into scripts list.
  const originalCreate = document.createElement.bind(document);
  document.createElement = (tag) => originalCreate(tag);

  globalThis.document = document;
  globalThis.window = {
    document,
    get ttq() {
      return this._ttq;
    },
    set ttq(v) {
      this._ttq = v;
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
  return { scripts, headChildren, store };
}

function clearDom() {
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.sessionStorage;
}

test("resolveTikTokPixelId prefers override, then env, then default", () => {
  const prevPublic = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
  const prevRuntime = process.env.TIKTOK_PIXEL_ID;
  delete process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
  delete process.env.TIKTOK_PIXEL_ID;
  assert.equal(resolveTikTokPixelId("CUSTOM123"), "CUSTOM123");
  assert.equal(resolveTikTokPixelId(""), JALWA_TIKTOK_PIXEL_DEFAULT);
  process.env.TIKTOK_PIXEL_ID = "FROM_RUNTIME";
  assert.equal(resolveTikTokPixelId(), "FROM_RUNTIME");
  process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID = "FROM_PUBLIC";
  assert.equal(resolveTikTokPixelId(), "FROM_PUBLIC");
  if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
  else process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID = prevPublic;
  if (prevRuntime === undefined) delete process.env.TIKTOK_PIXEL_ID;
  else process.env.TIKTOK_PIXEL_ID = prevRuntime;
});

test("ensureTikTokPixel loads script and fires page once", () => {
  const { scripts, headChildren } = installMockDom();
  __resetTikTokPixelForTests();
  delete process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
  delete process.env.TIKTOK_PIXEL_ID;
  const meta = document.createElement("meta");
  meta.name = JALWA_TIKTOK_PIXEL_META;
  meta.content = JALWA_TIKTOK_PIXEL_DEFAULT;
  document.head.appendChild(meta);
  assert.equal(headChildren.length, 1);

  // Seed an existing script node so insertBefore path has a parent.
  const seed = document.createElement("script");
  seed.src = "https://example.com/seed.js";
  seed.parentNode = {
    insertBefore(node) {
      scripts.push(node);
      return node;
    },
  };
  // Make getElementsByTagName return seed as first
  document.getElementsByTagName = () => ({ 0: seed, length: 1 });

  const id = ensureTikTokPixel();
  assert.equal(id, JALWA_TIKTOK_PIXEL_DEFAULT);
  const tiktokScripts = scripts.filter((s) => String(s.src).includes("analytics.tiktok.com"));
  assert.equal(tiktokScripts.length, 1);
  ensureTikTokPixel();
  assert.equal(scripts.filter((s) => String(s.src).includes("analytics.tiktok.com")).length, 1);
  clearDom();
});

test("Subscribe conversion is deduped by event_id", () => {
  installMockDom();
  __resetTikTokPixelForTests();
  const tracks = [];
  const seed = document.createElement("script");
  seed.parentNode = {
    insertBefore(node) {
      return node;
    },
  };
  document.getElementsByTagName = () => ({ 0: seed, length: 1 });

  ensureTikTokPixel(JALWA_TIKTOK_PIXEL_DEFAULT);
  window.ttq.track = (event, payload, options) => {
    tracks.push({ event, payload, options });
  };

  assert.equal(logTikTokEvent("Subscribe", { value: 990 }, { event_id: "order-1" }), true);
  assert.equal(logTikTokEvent("Subscribe", { value: 990 }, { event_id: "order-1" }), false);
  assert.equal(wasTikTokConversionFired("Subscribe", "order-1"), true);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].options.event_id, "order-1");
  clearDom();
});

test("landing helpers fire ViewContent, AddToCart, InitiateCheckout, Subscribe", () => {
  installMockDom();
  __resetTikTokPixelForTests();
  const tracks = [];
  const seed = document.createElement("script");
  seed.parentNode = {
    insertBefore(node) {
      return node;
    },
  };
  document.getElementsByTagName = () => ({ 0: seed, length: 1 });
  ensureTikTokPixel(JALWA_TIKTOK_PIXEL_DEFAULT);
  window.ttq.track = (event, payload, options) => {
    tracks.push({ event, payload, options });
  };

  assert.equal(landingOfferValuePkr("premium-monthly-pkr"), 990);
  trackLandingView({
    landing: "landing1",
    landingPath: "/landing1",
    planCode: "premium-monthly-pkr",
    utm: "T",
    packageCode: "1",
    parameter: "monthly10k",
    payment: "jazzcash",
  });
  trackLandingCheckoutIntent({
    landing: "landing1",
    planCode: "premium-monthly-pkr",
    utm: "T",
    packageCode: "1",
    parameter: "monthly10k",
    payment: "jazzcash",
  });
  trackLandingPaymentSuccess({
    orderId: "sub-abc",
    planCode: "premium-monthly-pkr",
    landing: "landing1",
    utm: "T",
    parameter: "monthly10k",
  });
  trackLandingPaymentSuccess({
    orderId: "sub-abc",
    planCode: "premium-monthly-pkr",
  });

  const names = tracks.map((t) => t.event);
  assert.deepEqual(names, ["ViewContent", "AddToCart", "InitiateCheckout", "Subscribe"]);
  clearDom();
});

test("wiring + CSP + product record cover Jalwa Pixel ID", async () => {
  const read = (rel) => readFile(new URL(`../../../${rel}`, import.meta.url), "utf8");
  const [
    nextConfig,
    caddy,
    layout,
    boot,
    subscribe,
    callback,
    prompt,
    envExample,
    productMd,
  ] = await Promise.all([
    read("apps/web/next.config.ts"),
    read("infrastructure/production/Caddyfile"),
    read("apps/web/app/layout.tsx"),
    read("apps/web/app/landing/landing-analytics-boot.tsx"),
    read("apps/web/app/landing/landing-subscribe.tsx"),
    read("apps/web/app/callback/route.ts"),
    read("apps/web/components/post-jazzcash-auth-prompt.tsx"),
    read(".env.example"),
    read("docs/product/TIKTOK_PIXEL_INTEGRATION.md"),
  ]);

  assert.match(nextConfig, /analytics\.tiktok\.com/);
  assert.match(caddy, /analytics\.tiktok\.com/);
  assert.match(layout, /TikTokRuntimeConfig/);
  assert.match(layout, /TikTokPixelBoot/);
  assert.match(boot, /trackLandingView/);
  assert.match(subscribe, /trackLandingCheckoutIntent/);
  assert.match(callback, /searchParams\.set\("order"/);
  assert.match(prompt, /trackLandingPaymentSuccess/);
  assert.match(envExample, /TIKTOK_PIXEL_ID=DBU5R83C77UCDH70PUCG/);
  assert.match(productMd, /DBU5R83C77UCDH70PUCG/);
  assert.match(productMd, /landing1\?utm=T/);
  assert.match(productMd, /not the official source of truth/i);
});
