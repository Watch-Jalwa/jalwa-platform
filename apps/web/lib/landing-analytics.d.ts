export type LandingAnalyticsContext = {
  landing: string;
  landingPath?: string;
  planCode: string;
  utm?: string;
  packageCode?: string;
  parameter?: string;
  payment?: string;
};

export function landingOfferValuePkr(planCode: string): number;
export function landingContentName(planCode: string, parameter?: string): string;
export function trackLandingView(ctx: LandingAnalyticsContext): void;
export function trackLandingCheckoutIntent(ctx: LandingAnalyticsContext): void;
export function trackLandingPaymentSuccess(args: {
  orderId: string;
  planCode?: string;
  landing?: string;
  utm?: string;
  parameter?: string;
  checkoutMode?: string;
}): void;
