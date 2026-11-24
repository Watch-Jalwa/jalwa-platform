/**
 * Browser TikTok Pixel loader + track helper.
 * Marketing only — never the source of truth for paid entitlements.
 * Failures must never throw into checkout / payment return / auth.
 */

export const JALWA_TIKTOK_PIXEL_META = "jalwa-tiktok-pixel-id";
/** Client-supplied Jalwa Pixel (landing1 / utm=T). Overridable via env. */
export const JALWA_TIKTOK_PIXEL_DEFAULT = "DBU5R83C77UCDH70PUCG";

const DEDUPE_PREFIX = "jalwa.tt.event.";

function readMetaPixelId() {
  if (typeof document === "undefined") return "";
  const el = document.querySelector(`meta[name="${JALWA_TIKTOK_PIXEL_META}"]`);
  return String(el?.getAttribute("content") ?? "").trim();
}

export function resolveTikTokPixelId(override) {
  const fromOverride = String(override ?? "").trim();
  if (fromOverride) return fromOverride;
  if (typeof process !== "undefined") {
    const fromEnv = String(
      process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID ?? process.env.TIKTOK_PIXEL_ID ?? "",
    ).trim();
    if (fromEnv) return fromEnv;
  }
  const fromMeta = readMetaPixelId();
  if (fromMeta) return fromMeta;
  return JALWA_TIKTOK_PIXEL_DEFAULT;
}

/** Install TikTok's standard ttq stub (queue until events.js loads). */
function ensureTtqStub() {
  if (typeof window === "undefined") return null;
  try {
    const w = window;
    const n = "ttq";
    w.TiktokAnalyticsObject = n;
    if (w.ttq && w.ttq._jalwaReady) return w.ttq;
    const ttq = (w.ttq = w.ttq || []);
    ttq.methods = [
      "page",
      "track",
      "identify",
      "instances",
      "debug",
      "on",
      "off",
      "once",
      "ready",
      "alias",
      "group",
      "enableCookie",
      "disableCookie",
      "holdConsent",
      "revokeConsent",
      "grantConsent",
    ];
    ttq.setAndDefer = function setAndDefer(t, method) {
      t[method] = function (...args) {
        (t.queue = t.queue || []).push([method].concat(args));
      };
    };
    for (const method of ttq.methods) {
      ttq.setAndDefer(ttq, method);
    }
    ttq.instance = function instance(id) {
      const inst = (ttq._i = ttq._i || {});
      inst[id] = inst[id] || [];
      for (const method of ttq.methods) {
        ttq.setAndDefer(inst[id], method);
      }
      return inst[id];
    };
    ttq.load = function load(pixelId, options) {
      const i = "https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i = ttq._i || {};
      ttq._i[pixelId] = [];
      ttq._i[pixelId]._u = i;
      ttq._t = ttq._t || {};
      ttq._t[pixelId] = Date.now();
      ttq._o = ttq._o || {};
      ttq._o[pixelId] = options || {};
      const existing = document.querySelector(`script[data-jalwa-tiktok-pixel="${pixelId}"]`);
      if (existing) return;
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.async = true;
      script.src = `${i}?sdkid=${encodeURIComponent(pixelId)}&lib=${n}`;
      script.dataset.jalwaTiktokPixel = pixelId;
      const first = document.getElementsByTagName("script")[0];
      if (first?.parentNode) {
        first.parentNode.insertBefore(script, first);
      } else {
        document.head.appendChild(script);
      }
    };
    ttq._jalwaReady = true;
    return ttq;
  } catch {
    return null;
  }
}

let loadedPixelId = null;
let pageFired = false;

/** Load Pixel SDK and fire base PageView once per page load. Never throws. */
export function ensureTikTokPixel(pixelIdOverride) {
  try {
    const pixelId = resolveTikTokPixelId(pixelIdOverride);
    if (!pixelId || typeof window === "undefined") return null;
    const ttq = ensureTtqStub();
    if (!ttq) return null;
    if (loadedPixelId !== pixelId) {
      ttq.load(pixelId);
      loadedPixelId = pixelId;
      pageFired = false;
    }
    if (!pageFired) {
      ttq.page();
      pageFired = true;
    }
    return pixelId;
  } catch {
    return null;
  }
}

function conversionKey(eventName, eventId) {
  return `${DEDUPE_PREFIX}${eventName}:${eventId}`;
}

export function wasTikTokConversionFired(eventName, eventId) {
  try {
    if (!eventId) return false;
    const key=conversionKey(eventName,eventId);
    return (typeof localStorage!=="undefined" && localStorage.getItem(key)==="1") ||
      (typeof sessionStorage!=="undefined" && sessionStorage.getItem(key)==="1");
  } catch {
    return false;
  }
}

export function markTikTokConversionFired(eventName, eventId) {
  try {
    if (!eventId) return;
    const key=conversionKey(eventName,eventId);
    if(typeof localStorage!=="undefined")localStorage.setItem(key,"1");
    if(typeof sessionStorage!=="undefined")sessionStorage.setItem(key,"1");
  } catch {
    /* ignore */
  }
}

/**
 * Track a TikTok event. Never throws.
 * Jalwa client-approved events: PageView, ViewContent, InitiateCheckout, AddPaymentInfo, Subscribe.
 * Do not fire AddToCart or CompletePayment unless newly requested.
 * For Subscribe (and CompletePayment if ever requested), pass options.event_id — dedupe is applied.
 */
export function logTikTokEvent(eventName, payload = {}, options = {}) {
  try {
    const pixelId = ensureTikTokPixel(options.pixelId);
    if (!pixelId || typeof window === "undefined" || typeof window.ttq?.track !== "function") {
      return false;
    }
    const eventId = String(options.event_id ?? "").trim();
    const isConversion = eventName === "Subscribe" || eventName === "CompletePayment";
    if (isConversion && (!eventId || wasTikTokConversionFired(eventName, eventId))) {
      return false;
    }
    if (eventId) {
      window.ttq.track(eventName, payload, { event_id: eventId });
    } else {
      window.ttq.track(eventName, payload);
    }
    if (isConversion && eventId) {
      markTikTokConversionFired(eventName, eventId);
    }
    return true;
  } catch {
    return false;
  }
}

/** Reset module state (tests only). */
export function __resetTikTokPixelForTests() {
  loadedPixelId = null;
  pageFired = false;
  if (typeof window !== "undefined" && window.ttq) {
    try {
      delete window.ttq._jalwaReady;
      window.ttq = undefined;
    } catch {
      /* ignore */
    }
  }
}
