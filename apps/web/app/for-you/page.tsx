import { RecommendationRail } from "@/components/recommendation-rail";
import { getRecommendations } from "@/lib/recommendations/repository";

export const metadata = { title: "For You" };
export const dynamic = "force-dynamic";

export default async function ForYouPage() {
  const items = await getRecommendations({ limit: 48 });
  return <div className="page-shell for-you-page">
    <section className="for-you-hero"><span className="eyebrow">For You</span><h1>Your next useful watch.</h1><p>Jalwa combines your selected profile, watch progress, interests, fresh releases and community signals. Rights, Premium access and kids-mode rules are applied before ranking.</p></section>
    <RecommendationRail items={items} title="Picked for this viewer" placement="for-you" />
    <p className="policy-notice">Recommendations improve from viewing activity. Use Hide or Report on content to reduce similar suggestions.</p>
  </div>;
}
