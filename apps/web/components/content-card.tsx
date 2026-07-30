import Link from "next/link";
import type { DemoContentItem } from "@/lib/catalogue/demo-data";

export function ContentCard({ item }: { item: DemoContentItem }) {
  return (
    <article className="content-card">
      <Link href={`/watch/${item.slug}`}>
        <div className="content-art"><span>{item.access}</span></div>
        <h3>{item.title}</h3><p>{item.category} · {item.duration}</p>
      </Link>
    </article>
  );
}
