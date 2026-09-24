import type { Metadata } from "next";
import { AskJalwa } from "@/components/ask-jalwa";
import { hasActivePremiumBenefit } from "@/lib/premium/access";
import { resolveAiDailyLimit } from "@/lib/premium/benefits";

export const metadata: Metadata = {
  title: "Ask Jalwa",
  description: "Ask grounded questions using approved Jalwa content.",
};

export default async function AskPage() {
  const premium = await hasActivePremiumBenefit("ai_plus");
  const dailyLimit = resolveAiDailyLimit(premium, {
    premium: Number(process.env.AI_PREMIUM_DAILY_LIMIT ?? 50),
    free: Number(process.env.AI_FREE_DAILY_LIMIT ?? 5),
  });
  return (
    <div className="page-shell ask-page">
      <header className="ask-hero">
        <span className="eyebrow">AI-powered discovery</span>
        <h1>Ask Jalwa</h1>
        <p>Find useful Pakistani content and receive source-backed explanations in Urdu, Roman Urdu or English.</p>
        <p className="policy-notice" data-testid="ask-jalwa-allowance">{premium ? "Premium" : "Free"} allowance: {dailyLimit} questions per day.</p>
      </header>
      <AskJalwa />
    </div>
  );
}
