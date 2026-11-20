import { SignInForm } from "../login/sign-in-form";
import { safeInternalPath } from "@/lib/runtime";

export const metadata = { title: "Sign up — Jalwa" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const plan = typeof params.plan === "string" ? params.plan : "";
  const requestedNext = typeof params.next === "string" ? params.next : "/onboarding";
  const nextBase = safeInternalPath(requestedNext, "/onboarding");
  const next = plan
    ? safeInternalPath(`${nextBase}${nextBase.includes("?") ? "&" : "?"}plan=${encodeURIComponent(plan)}`, "/onboarding")
    : nextBase;
  const prefillIdentity = typeof params.prefill === "string" ? params.prefill : "";

  return (
    <div className="page-shell auth-journey">
      <section className="auth-intro">
        <span className="eyebrow">Welcome to Jalwa</span>
        <h1>Create account</h1>
        <p>
          Enter your full name, JazzCash mobile number and password. Already linked a wallet as a guest? Use the same
          number here.
        </p>
      </section>
      <div className="auth-methods">
        <SignInForm next={next} prefillIdentity={prefillIdentity} mode="signup" />
      </div>
    </div>
  );
}
