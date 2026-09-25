import type { Metadata } from "next";
import { AskJalwa } from "@/components/ask-jalwa";
import { resolveAiDailyLimit } from "@/lib/premium/benefits.mjs";
import { hasPremiumBenefit } from "@/lib/premium/server";

export const metadata: Metadata = {
  title: "Ask Jalwa",
  description: "Ask grounded questions using approved Jalwa content.",
};

export default async function AskPage() {
  const premium = await hasPremiumBenefit("ai_plus");
  const dailyLimit = resolveAiDailyLimit(premium, Number(process.env.AI_FREE_DAILY_LIMIT ?? 5), Number(process.env.AI_PREMIUM_DAILY_LIMIT ?? 50));
  return (
    <div className="page-shell ask-page">
      <header className="ask-hero">
        <span className="eyebrow">AI-powered discovery</span>
        <h1>Ask Jalwa</h1>
        <p>Find useful Pakistani content and receive source-backed explanations in Urdu, Roman Urdu or English.</p>\n        <p className="policy-notice" data-testid="ask-jalwa-allowance">{premium ? "Premium allowance" : "Free allowance"}: {dailyLimit} questions/day when Ask Jalwa is enabled.</p>
      </header>
      <AskJalwa />
    </div>
  );
}
