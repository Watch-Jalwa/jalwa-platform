import Link from "next/link";
import "@/app/landing/landing.css";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function JazzcashCallbackResultPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const ok = params.status === "ok";
  const msisdn = typeof params.msisdn === "string" ? params.msisdn : "";
  const loginHref = msisdn
    ? `/login?next=${encodeURIComponent("/premium")}&prefill=${encodeURIComponent(msisdn)}`
    : `/login?next=${encodeURIComponent("/premium")}`;

  return (
    <div className="campaign-landing">
      <div className="callback-shell">
        <span className="eyebrow">JazzCash</span>
        <h1>{ok ? "Payment received" : "Almost there"}</h1>
        <p>
          {ok
            ? "JazzCash wallet linking completed. Sign in with the same mobile number to open Premium."
            : "JazzCash did not confirm the wallet link yet. Sign in with the same number or try Subscribe Now again."}
        </p>
        <div style={{ display: "grid", gap: "0.75rem", marginTop: "1.25rem" }}>
          <Link className="landing-cta" href={loginHref}>Sign in with same number</Link>
          <Link className="button button-secondary" href="/">Back to Jalwa</Link>
        </div>
      </div>
    </div>
  );
}
