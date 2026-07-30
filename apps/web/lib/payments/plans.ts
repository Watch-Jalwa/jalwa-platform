export type PublicPrice = {
  id: string;
  code: string;
  amountMinor: number;
  currency: string;
  billingPeriod: string;
  durationDays: number;
};

export function formatPkr(amountMinor: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 })
    .format(amountMinor / 100);
}

export const PREMIUM_BENEFITS = [
  "Full authorised Jalwa catalogue",
  "Jalwa Originals and early access",
  "Ad-free Jalwa interface",
  "Enhanced playback quality",
  "Larger Ask Jalwa allowance",
  "Premium collections",
];
