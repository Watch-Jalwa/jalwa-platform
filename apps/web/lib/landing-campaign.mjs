const MONTHLY = "premium-monthly-pkr";
const YEARLY = "premium-annual-pkr";

function firstString(value) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim();
  return "";
}

function clip(value, max = 80) {
  return String(value ?? "").trim().slice(0, max);
}

export function packageToPlanCode(packageValue, parameter = "") {
  const pkg = String(packageValue ?? "").trim().toLowerCase();
  const param = String(parameter ?? "").trim().toLowerCase();
  if (pkg === "2" || pkg === "yearly" || pkg === "annual") {
    return YEARLY;
  }
  if (pkg === "default" || pkg === "1" || pkg === "monthly" || pkg === "" || param === "monthly10k") {
    return MONTHLY;
  }
  return MONTHLY;
}

export function normalizeLandingCampaign(searchParams, defaults) {
  const params = searchParams instanceof URLSearchParams
    ? Object.fromEntries(searchParams.entries())
    : (searchParams ?? {});

  const utm = clip(firstString(params.utm) || defaults.utm);
  const packageValue = clip(firstString(params.package) || defaults.package);
  const parameter = clip(firstString(params.parameter) || defaults.parameter);
  const payment = clip(firstString(params.payment) || defaults.payment || "jazzcash").toLowerCase();
  const he = clip(firstString(params.he));
  const ref = clip(firstString(params.ref));
  const utmSource = clip(firstString(params.utm_source) || utm);
  const utmMedium = clip(firstString(params.utm_medium));
  const utmCampaign = clip(firstString(params.utm_campaign));
  const utmContent = clip(firstString(params.utm_content));
  const planCode = packageToPlanCode(packageValue, parameter);

  return {
    utm,
    package: packageValue,
    parameter,
    payment,
    he: he || undefined,
    ref: ref || undefined,
    utm_source: utmSource || undefined,
    utm_medium: utmMedium || undefined,
    utm_campaign: utmCampaign || undefined,
    utm_content: utmContent || undefined,
    planCode,
    landing: defaults.landing,
    landingPath: defaults.landingPath,
    queryString: new URLSearchParams({
      utm,
      package: packageValue,
      parameter,
      payment,
      ...(he ? { he } : {}),
    }).toString(),
  };
}

export function normalizeDefaultLandingCampaign(searchParams) {
  return normalizeLandingCampaign(searchParams, {
    utm: "D",
    package: "default",
    parameter: "default",
    payment: "jazzcash",
    landing: "mainLanding",
    landingPath: "/",
  });
}

export function normalizeLanding1Campaign(searchParams) {
  return normalizeLandingCampaign(searchParams, {
    utm: "T",
    package: "1",
    parameter: "monthly10k",
    payment: "jazzcash",
    landing: "landing1",
    landingPath: "/landing1",
  });
}

export function attributionForBilling(campaign) {
  return {
    utm: campaign.utm,
    utm_source: campaign.utm_source ?? campaign.utm,
    utm_medium: campaign.utm_medium,
    utm_campaign: campaign.utm_campaign,
    utm_content: campaign.utm_content,
    package: campaign.package,
    parameter: campaign.parameter,
    payment: campaign.payment,
    ref: campaign.ref,
    landing: campaign.landing,
    landingPath: campaign.landingPath,
    he: campaign.he,
  };
}
