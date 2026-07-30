export type PolicySection = { heading: string; body: string[] };
export type PolicyDocument = { title: string; summary: string; reviewNotice?: string; sections: PolicySection[] };

export const policies: Record<string, PolicyDocument> = {
  terms: {
    title: "Terms of Use",
    summary: "Rules for using Jalwa, including accounts, content access, subscriptions and acceptable use.",
    reviewNotice: "Launch draft — obtain Pakistan legal review before enabling paid production access.",
    sections: [
      { heading: "Using Jalwa", body: ["You must provide accurate account information, keep access credentials secure and use Jalwa only for lawful purposes.", "Jalwa may suspend access where fraud, abuse, security risk or a material breach is reasonably suspected."] },
      { heading: "Content", body: ["Jalwa includes original, licensed, openly licensed and officially embedded third-party content.", "Third-party players and links remain subject to their provider terms. Availability can change without notice."] },
      { heading: "Subscriptions", body: ["Paid access starts only after Jalwa verifies payment through the payment provider.", "Benefits, prices and renewal terms are shown before checkout. A time-bound pass does not automatically renew unless checkout clearly states otherwise."] },
      { heading: "Acceptable use", body: ["Do not bypass access controls, scrape the service, share premium playback links, probe systems, upload malicious files or misuse Ask Jalwa."] },
      { heading: "Service changes", body: ["Jalwa may improve, replace or discontinue features while preserving paid rights required by applicable law and the checkout terms presented to you."] },
    ],
  },
  privacy: {
    title: "Privacy Notice",
    summary: "What Jalwa collects, why it is used and how account requests are handled.",
    reviewNotice: "Launch draft — confirm retention periods, processors and Pakistan privacy obligations before production.",
    sections: [
      { heading: "Information collected", body: ["Jalwa may collect account identifiers, profile preferences, watch activity, favourites, subscription records, support requests, security logs and AI usage metadata.", "Payment credentials are handled by the payment provider and are not stored by Jalwa."] },
      { heading: "How it is used", body: ["Information is used to provide accounts, playback, subscriptions, recommendations, customer support, security, analytics and Ask Jalwa."] },
      { heading: "Service providers", body: ["Jalwa may use infrastructure, database, storage, analytics, AI and payment providers under appropriate access and security controls."] },
      { heading: "Your choices", body: ["You may request access, correction, export or deletion from Profile or Support. Certain financial, rights and security records may be retained where legally or operationally required."] },
      { heading: "AI", body: ["Ask Jalwa questions are processed to answer the request, enforce safety and measure usage. Avoid submitting sensitive personal or confidential information."] },
    ],
  },
  subscriptions: {
    title: "Subscription Terms",
    summary: "How monthly, annual and time-bound Premium access works.",
    reviewNotice: "Launch draft — align with the selected merchant agreement and checkout wording.",
    sections: [
      { heading: "Plans", body: ["The checkout page shows the plan price, currency, duration, benefits and whether renewal is automatic."] },
      { heading: "Activation", body: ["Premium access activates after a verified provider callback or completed reconciliation. A browser return page or payment screenshot alone does not confirm payment."] },
      { heading: "Renewal and expiry", body: ["Time-bound passes expire at the stated time. Recurring plans renew only with explicit consent and supported provider billing."] },
      { heading: "Benefit limits", body: ["AI usage and other resource-intensive features may have fair-use limits shown in the product. Embedded third-party advertising may remain visible inside third-party players."] },
    ],
  },
  refunds: {
    title: "Refund and Cancellation Policy",
    summary: "How to request cancellation, correction or a refund.",
    reviewNotice: "Launch draft — final refund windows require business and legal approval.",
    sections: [
      { heading: "Cancellation", body: ["A recurring plan can be cancelled for future periods through the available account or support route. Cancelling does not normally remove access already paid for."] },
      { heading: "Refund requests", body: ["Contact Support with the Jalwa order reference, payment-provider reference and reason. Do not send card numbers, PINs or OTPs."] },
      { heading: "Duplicate or failed payments", body: ["Jalwa will investigate duplicate charges, amount mismatches and payments that succeeded at the provider but did not activate access."] },
      { heading: "Provider timelines", body: ["Approved refunds may take additional time to appear depending on the bank, wallet or payment provider."] },
    ],
  },
  copyright: {
    title: "Copyright and Takedown",
    summary: "How rights holders can report content and how Jalwa handles notices.",
    sections: [
      { heading: "Report content", body: ["Send the content URL, identification of the protected work, your contact details, the basis of your rights and a good-faith statement through Support."] },
      { heading: "Review", body: ["Jalwa may restrict content while reviewing a credible notice, preserve rights evidence and contact the source or publishing partner."] },
      { heading: "Outcomes", body: ["Content may be restored, attributed differently, edited where permitted or permanently removed. Repeated source problems may disable future imports."] },
      { heading: "Misrepresentation", body: ["Do not submit knowingly false or misleading notices."] },
    ],
  },
  "ai-safety": {
    title: "AI Safety Notice",
    summary: "Important limits for Ask Jalwa and AI-assisted content.",
    sections: [
      { heading: "Grounded assistance", body: ["Ask Jalwa is designed to answer from approved Jalwa catalogue sources and show citations, but AI can still misunderstand context or produce errors."] },
      { heading: "High-consequence topics", body: ["Do not rely on Ask Jalwa as a substitute for qualified medical, legal, financial, religious, agricultural, pesticide or veterinary advice."] },
      { heading: "Privacy", body: ["Do not enter passwords, payment details, OTPs, confidential documents or unnecessary sensitive personal information."] },
      { heading: "Reporting", body: ["Use the Support page to report unsafe, inaccurate or inappropriate AI responses and include the relevant question without including secrets."] },
    ],
  },
};

export const policySlugs = Object.keys(policies);
