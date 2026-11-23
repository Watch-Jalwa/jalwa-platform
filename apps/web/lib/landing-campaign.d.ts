export function packageToPlanCode(packageValue: string, parameter?: string): string;

export function normalizeLandingCampaign(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
  defaults: {
    utm: string;
    package: string;
    parameter: string;
    payment?: string;
    landing: string;
    landingPath: string;
  },
): {
  utm: string;
  package: string;
  parameter: string;
  payment: string;
  he?: string;
  ref?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  planCode: string;
  landing: string;
  landingPath: string;
  queryString: string;
};

export function normalizeDefaultLandingCampaign(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
): ReturnType<typeof normalizeLandingCampaign>;

export function normalizeLanding1Campaign(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
): ReturnType<typeof normalizeLandingCampaign>;

export function attributionForBilling(campaign: {
  utm: string;
  package: string;
  parameter: string;
  payment: string;
  planCode?: string;
  landing: string;
  landingPath: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  ref?: string;
  he?: string;
}): Record<string, string | undefined>;
