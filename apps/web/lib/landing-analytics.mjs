/**
 * Landing / pay-first funnel analytics helpers.
 * Fires TikTok beside any existing GA4 call sites. Marketing only.
 */

import { logTikTokEvent, ensureTikTokPixel } from "./tiktok-pixel.mjs";

/** Display PKR major units for known plan codes (marketing payloads only). */
export function landingOfferValuePkr(planCode) {
  const code = String(planCode ?? "").toLowerCase();
  if (code.includes("annual") || code.includes("yearly")) return 2999;
  return 990;
}

export function landingContentName(planCode, parameter) {
  const code = String(planCode ?? "");
  if (code.includes("annual") || code.includes("yearly")) return "Jalwa Premium Annual";
  if (parameter === "monthly10k") return "Jalwa Premium Monthly (10k credits)";
  return "Jalwa Premium Monthly";
}

export function trackLandingView(ctx) {
  try {
    ensureTikTokPixel();
    const value = landingOfferValuePkr(ctx.planCode);
    const contentName = landingContentName(ctx.planCode, ctx.parameter);
    logTikTokEvent("ViewContent", {
      contents: [
        {
          content_id: ctx.planCode,
          content_type: "product",
          content_name: contentName,
        },
      ],
      content_type: "product",
      value,
      currency: "PKR",
      traffic_source: ctx.utm,
      utm_code: ctx.utm,
      banner_parameter: ctx.parameter,
      landing: ctx.landing,
      landing_path: ctx.landingPath,
      package: ctx.packageCode,
      payment: ctx.payment,
    });
  } catch {
    /* never break landing */
  }
}

export function trackLandingCheckoutIntent(ctx) {
  try {
    ensureTikTokPixel();
    const value = landingOfferValuePkr(ctx.planCode);
    const contentName = landingContentName(ctx.planCode, ctx.parameter);
    const base = {
      contents: [
        {
          content_id: ctx.planCode,
          content_type: "product",
          content_name: contentName,
        },
      ],
      content_type: "product",
      value,
      currency: "PKR",
      traffic_source: ctx.utm,
      utm_code: ctx.utm,
      banner_parameter: ctx.parameter,
      landing: ctx.landing,
      package: ctx.packageCode,
      payment: ctx.payment,
    };
    logTikTokEvent("InitiateCheckout", base);
    logTikTokEvent("AddPaymentInfo", base);
  } catch {
    /* never break checkout */
  }
}

/**
 * Fire Subscribe once per order/request id after confirmed Premium activation.
 * Do not call on failed / pending returns.
 */
export function trackLandingPaymentSuccess(args) {
  try {
    const orderId = String(args.orderId ?? "").trim();
    if (!orderId) return;
    const planCode = args.planCode || "premium-monthly-pkr";
    const value = landingOfferValuePkr(planCode);
    logTikTokEvent(
      "Subscribe",
      {
        contents: [
          {
            content_id: planCode,
            content_type: "product",
            content_name: landingContentName(planCode, args.parameter),
          },
        ],
        content_type: "product",
        value,
        currency: "PKR",
        traffic_source: args.utm,
        landing: args.landing,
        ...(args.checkoutMode ? { checkout_mode: args.checkoutMode } : {}),
      },
      { event_id: orderId },
    );
  } catch {
    /* never break return UX */
  }
}
