import { notFound } from "next/navigation";
import { policies, policySlugs } from "@/lib/legal/policies";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return policySlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const policy = policies[slug];
  return policy ? { title: policy.title, description: policy.summary } : {};
}

export default async function LegalPage({ params }: { params: Params }) {
  const { slug } = await params;
  const policy = policies[slug];
  if (!policy) notFound();

  return (
    <div className="page-shell policy-page">
      <header className="policy-header">
        <span className="eyebrow">Jalwa policy</span>
        <h1>{policy.title}</h1>
        <p>{policy.summary}</p>
        <small>Last updated: 30 July 2026</small>
      </header>
      {policy.reviewNotice ? <aside className="policy-notice">{policy.reviewNotice}</aside> : null}
      <div className="policy-sections">
        {policy.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </section>
        ))}
      </div>
    </div>
  );
}
