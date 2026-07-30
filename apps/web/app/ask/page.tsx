import type { Metadata } from "next";
import { AskJalwa } from "@/components/ask-jalwa";

export const metadata: Metadata = {
  title: "Ask Jalwa",
  description: "Ask grounded questions using approved Jalwa content.",
};

export default function AskPage() {
  return (
    <div className="page-shell ask-page">
      <header className="ask-hero">
        <span className="eyebrow">AI-powered discovery</span>
        <h1>Ask Jalwa</h1>
        <p>Find useful Pakistani content and receive source-backed explanations in Urdu, Roman Urdu or English.</p>
      </header>
      <AskJalwa />
    </div>
  );
}
