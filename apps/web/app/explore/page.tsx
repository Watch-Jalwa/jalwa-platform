import { ContentCard } from "@/components/content-card";
import { featuredContent } from "@/lib/catalogue/demo-data";

export const metadata = { title: "Explore" };

export default function ExplorePage() {
  return (
    <div className="page-shell">
      <div className="section-heading">
        <div><span className="eyebrow">Catalogue</span><h1>Explore Jalwa</h1></div>
      </div>
      <div className="content-grid">
        {featuredContent.map((item) => <ContentCard item={item} key={item.slug} />)}
      </div>
    </div>
  );
}
